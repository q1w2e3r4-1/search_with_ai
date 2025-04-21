import { Context } from 'koa';
import { Rag } from './service/rag';
import { getChatByProvider, getInfoByProvider } from './libs/provider';
import { DefaultQuery } from './libs/utils/constant';
import Models from './model.json';
import { searchWithSogou } from './service/search';
import { TSearchEngine, IChatInputMessage, Provider, TSearchMode, IProviderModel, IChatResponse } from './interface';
import { getFromCache, setToCache } from './cache';
import { ESearXNGCategory } from './libs/search/searxng';
import { getProviderKeys } from './config';
import { DeepResearch, EResearchProgress } from './service/research';

const CACHE_ENABLED = process.env.CACHE_ENABLE;

const models = Models as IProviderModel[];

export const searchController = async (ctx: Context) => {
  console.log("got ctx:", ctx)

  const q = ctx.request.query.q || DefaultQuery;
  const reload: boolean = ctx.request.body.reload ?? false;
  // search engine
  const engine: TSearchEngine = ctx.request.body.engine;
  const categories: ESearXNGCategory[] = ctx.request.body.categories ?? [];
  const mode: TSearchMode = ctx.request.body.mode ?? 'simple';
  const language: string = ctx.request.body.language || 'all';
  // console.log("body:", ctx.request.body);
  // console.log(q, engine);
  // llm provider
  const provider: Provider = ctx.request.body.provider;
  const model: string = ctx.request.body.model;
  const stream = ctx.request.body.stream ?? true;

  ctx.res.setHeader('Content-Type', 'text/event-stream');
  ctx.res.setHeader('Cache-Control', 'no-cache');
  ctx.res.setHeader('Connection', 'keep-alive');
  ctx.res.statusCode = 200;

  // get from cache, skip if enable reload
  if (!reload) {
    const cached = await getFromCache(q as string, mode, categories);
    if (cached) {
      ctx.body = cached;
      ctx.res.write(cached, 'utf-8');
      ctx.res.end();
      return;
    }
  }

  const rag = new Rag({
    stream,
    model,
    engine,
    provider
  });

  if (!stream) {
    const res = await rag.query(q as string);
    ctx.body = res;
    return;
  }

  let result = '';

  await rag.query(q as string, categories, mode, language, (json: string) => {
    const eventData = `data:${JSON.stringify({ data: json })}\n\n`;
    result += eventData;
    ctx.res.write(eventData, 'utf-8');
  });
  ctx.res.write('[DONE] \n\n');
  ctx.res.end();
  // caching
  if (CACHE_ENABLED === '1') {
    setToCache(q as string, result, mode, categories);
  }
};

export const deepResearchController = async (ctx: Context) => {
  const query: string = ctx.request.body.query;
  // llm provider
  const provider: Provider = ctx.request.body.provider;
  const model: string = ctx.request.body.model;
  const reportModel: string = ctx.request.body.reportModel;
  // search engine
  const searchEngine: TSearchEngine = ctx.request.body.searchEngine;
  const llmProvider = getInfoByProvider(provider);
  // options
  const { depth = 2, breadth = 2 } = ctx.request.body;

  const { baseURL } = llmProvider;
  const keys = getProviderKeys();
  const apiKey = keys[provider];
  if (!baseURL || !provider) throw new Error('Provider not found');

  ctx.res.setHeader('Content-Type', 'text/event-stream');
  ctx.res.setHeader('Cache-Control', 'no-cache');
  ctx.res.setHeader('Connection', 'keep-alive');
  ctx.res.statusCode = 200;

  const deepResearch = new DeepResearch({
    llmOptions: {
      model,
      baseURL,
      apiKey,
      name: provider
    },
    reportLlmOptions: {
      model: reportModel,
      baseURL,
      apiKey,
      name: provider
    },
    searchEngine
  });

  const startTime = Date.now();


  // 创建心跳定时器
  const heartbeat = setInterval(() => {
    const eventData = `data: ${JSON.stringify({
      progress: EResearchProgress.Heartbeat,
      time: Date.now() - startTime
    })}\n\n`;
    ctx.res.write(eventData);
  }, 3000); // 3秒一次

  try {
    ctx.res.write(`data: ${JSON.stringify({
      progress: EResearchProgress.Analyzing,
      time: Date.now() - startTime
    })}\n\n`);

    const combinedQuery = await deepResearch.generateCombinedQuery({
      initialQuery: query,
      numFollowUpQuestions: 3
    });

    ctx.res.write(`data: ${JSON.stringify({
      progress: EResearchProgress.Start,
      time: Date.now() - startTime
    })}\n\n`);

    const { learnings, urls } = await deepResearch.research({
      query: combinedQuery,
      depth,
      breadth,
      onProgress: (progress) => {
        const eventData = `data: ${JSON.stringify({
          progress: EResearchProgress.Researching,
          time: Date.now() - startTime,
          researchProgress: progress
        })}\n\n`;
        ctx.res.write(eventData);
      }
    });

    const eventData = `data: ${JSON.stringify({
      progress: EResearchProgress.Done,
      time: Date.now() - startTime,
      researchProgress: {
        currentDepth: 0,
        currentQuery: null,
        visitedUrls: urls
      }
    })}\n\n`;
    ctx.res.write(eventData);

    ctx.res.write(`data: ${JSON.stringify({
      progress: EResearchProgress.Reporting,
      time: Date.now() - startTime
    })}\n\n`);

    await deepResearch.generateReport({
      combinedQuery,
      learnings,
      onProgress: (text: string) => {
        const eventData = `data: ${JSON.stringify({
          progress: EResearchProgress.Reporting,
          time: Date.now() - startTime,
          report: text
        })}\n\n`;
        ctx.res.write(eventData);
      }
    });

    ctx.res.write(`data: ${JSON.stringify({
      progress: EResearchProgress.Done,
      time: Date.now() - startTime,
      sources: urls
    })}\n\n`);

    ctx.res.write('[DONE] \n\n');
    ctx.res.end();

  } finally {
    clearInterval(heartbeat);
    ctx.res.end();
  }
};

export const sogouSearchController = async (ctx: Context) => {
  const q = ctx.request.query.q || DefaultQuery;
  const res = await searchWithSogou(q as string);
  ctx.body = res;
};

export const chatStreamController = async (ctx: Context) => {
  const messages: IChatInputMessage[] = ctx.request.body.messages || [];
  const system: string | undefined = ctx.request.body.system;
  const model: string | undefined = ctx.request.body.model;
  const provider: Provider = ctx.request.body.provider;

  if (!model) throw new Error('Model is required');
  if (!provider) throw new Error('Provider is required');

  ctx.res.setHeader('Content-Type', 'text/event-stream');
  ctx.res.setHeader('Cache-Control', 'no-cache');
  ctx.res.setHeader('Connection', 'keep-alive');
  const handler = getChatByProvider(provider);
  ctx.res.statusCode = 200;

  await handler?.({ messages, model, system }, (data: IChatResponse | null) => {
    const eventData = `data: ${JSON.stringify({ data })}\n\n`;
    ctx.res.write(eventData);
  });
  ctx.res.write('[DONE] \n\n');
  ctx.res.end();
};

export const modelsController = async (ctx: Context) => {
  const keys = getProviderKeys();
  const getModels = models.filter(item => keys[item.provider] !== undefined);
  const enabledModels: Record<string, string[]> = {};
  for (const model of getModels) {
    if (keys[model.provider]) enabledModels[model.provider] = model.models;
  }
  ctx.body = enabledModels;
};

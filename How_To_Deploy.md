# 如何部署服务, 以及一些常见问题

## A. Docker部署

这个相对比较简单，照着readme.md就能配好，所有用到的文件均在deploy目录下，你需要填写`.env.example` 中的部分内容，并将其命名为`.env.docker`. 

需要注意的是，这种方法用的是官方提供的容器，**无法修改源码**！！！若要修改源码，只能采用本地部署：

## B. 本地部署

项目源码均在apps下，server和web分别表示前后端，**所有的环境变量都需配置在server文件夹下**。

在apps/server目录下有一个`.env.example`, 你需填写部分内容(填写方法见readme.md), 然后复制两份，分别命名为`.env`和`.env.local`(没有深究哪个文件真正起作用，索性两个都加上)

下一步是安装yarn(指定版本)和turbo,你可以自行搜索教程，这里给出我当时与大模型的对话：

当你遇到 `error This project's package.json defines "packageManager": "yarn@3.5.1". However the current global version of Yarn is 1.22.22.` 错误时，这表明项目要求使用 `yarn@3.5.1` 版本，而你当前全局安装的是 `yarn 1.22.22` 版本，你需要将 Yarn 版本升级到 `3.5.1`。可以按照以下步骤操作：

### 大模型の智慧：

#### 1. 卸载当前全局的 Yarn

如果你使用的是 `npm` 全局安装的 Yarn 1.x 版本，可以使用以下命令卸载：

```bash
npm uninstall -g yarn
```

#### 2. 安装 Yarn 3.5.1

可以使用 `corepack`（Node.js 从 v16.13.0 开始内置）来安装指定版本的 Yarn：

##### 启用 corepack

```bash
corepack enable
```

##### 使用 corepack 安装 Yarn 3.5.1

```bash
corepack prepare yarn@3.5.1 --activate
```

#### 3. 验证 Yarn 版本

安装完成后，你可以使用以下命令验证 Yarn 版本：

```bash
yarn --version
```

确保输出为 `3.5.1`。

#### 4. 重新安装项目依赖

在项目根目录下，使用新安装的 Yarn 重新安装项目依赖：

```bash
yarn install
```

### 依赖安装完成之后：

恭喜，you are almost done。完成上述步骤后，你就可以继续按照之前的流程修改代码并部署到 Docker 容器中了，例如构建项目：

```bash
turbo build
```

或者启动开发环境：

```bash
turbo dev
```

（上面命令都是在根目录执行）

***最新版本的项目已不再使用searxng(由于老是搜不到内容)，但依旧可作为一种方式参考,如果只是想简单部署你可跳过下面几段***

但是这里只启动了前后端，而如果你使用的是searxng浏览器的话，你还需要额外部署searxng，你可以自行寻找部署方法，这里我的解决方案是，直接使用docker部署方法中的searxng镜像（为此，你可能首先按照docker部署的方法做一遍）

在项目根目录那里，执行：
```bash
docker compose up -d searxng
```

即可启动服务，如果正常（你用的应该就是根目录的那个docker-compose.yaml文件）的话，你应该能在localhost:8080端口看见网页。

通过以上方法便可正常在本地部署。祝好运

## C. 常见问题

### 1. 当配置了多个模型/搜索引擎时，我该如何切换他们？

点击红圈里的设置，在那里选择对应的设置即可。

![1](C:\Users\a1592\Pictures\Screenshots\1.png)

### 2. 我在Ollama上下载了几个模型，但是在上面设置的选项中没有看见，这是怎么回事？

如果想用自己的模型，你需要先在项目中注册。

在apps/server/src/model.json中，你可以清楚的看到每个url(LLM提供者)注册的模型名称，只要你在这里添加，重启服务应该就能看到。

tips: 对于Ollama, 你可以访问这个链接http://localhost:11434/api/tags ,以获取Ollama上已下载的模型

### 3. 搜索引擎比较

Searxng: 这个在不需要key的条件下可以直接访问google, bing, wiki等网站，缺点就是，google常年连不上，bing对于简单询问的反馈还行，但不知为何，一旦你的询问变长一点（例如：大模型的幻觉问题），就会显示搜索不到内容，从而导致ref=空，所以最后并没有使用它。

然后如果你单独使用Google，Bing的话效果还行，就是Google需要挂梯子，搜出来的大部分是英文资料，Bing Key的注册需要Visa卡比较麻烦。

所以我最后选择的是tavity，这个引擎在测试中表现不错，基本每次都能成功，一月1000次查询，而且注册也比较方便：[Tavily AI](https://app.tavily.com/home)

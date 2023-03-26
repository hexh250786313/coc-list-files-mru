[ 中文说明 ](https://blog.hexuhua.vercel.app/post/28)

# coc-list-files-mru

A files finder plugin running at hacked coc.nvim. You can open a files finder same as coc-lists files but it will show default mru list if there is no input.

It dependence on a coc.nvim client which supports dynamically switching the list data.That means you have to hack coc manually.

Not elegant but useful.

> Most codes are from https://github.com/neoclide/coc-lists

## Install

You need to have coc.nvim installed for this extension to work. Then run:

```
:CocInstall @hexuhua/coc-list-files-mru
```

Meanwhile, because coc does not support dynamically switching the list data, you must do the following to hack coc.nvim.

Find your coc.nvim install path and do the following changes in `/path/to/your/coc.nvim/build/index.js`

<img src="https://user-images.githubusercontent.com/26080416/227757531-3845157b-07b0-49f3-9910-5ed5a20cc3bb.png" width="75%">

Or execute these commands to do the same if you use [sd](https://github.com/chmln/sd):

```shell
sd '}\n.*set loading\(loading\)' '  this.mruFlag = true; } set loading(loading)' /path/to/your/coc.nvim/build/index.js
sd 'async drawItems\(\) \{' 'async drawItems(context) { var _a2; if (((_a2 = this.list) == null ? void 0 : _a2.name) === "filesMru") { if ((context == null ? void 0 : context.input.length) > 0 && this.mruFlag === true) { this.mruFlag = false; await this.loadItems(context); await this.drawItems(context); return; } if ((context == null ? void 0 : context.input.length) === 0 && this.mruFlag === false) { this.mruFlag = true; await this.loadItems(context); await this.drawItems(context); return; } }'  /path/to/your/coc.nvim/build/index.js
sd 'void this.worker.drawItems\(\);' 'void this.worker.drawItems(this.context);' /path/to/your/coc.nvim/build/index.js
```

## Usage

Run this:

```
:CocList filesMru
```

## Config

This plugin reads coc-lists files and mru list config.

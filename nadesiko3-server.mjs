/**
 * file: nadesiko3-server.mjs
 * Webサーバのためのプラグイン (expressをラップしたもの)
 */
import express from 'express'
import bodyParser from 'body-parser'

// 定数・変数
let WEBSERVER_NAME = 'WEBサーバ(なでしこ+Express)'
const ERROR_NO_INIT = '先に『WEBサーバ起動』命令を実行してください。'
let debug = true

const PluginExpress = {
  'meta': {
    type: 'const',
    value: {
      pluginName: 'nadesiko3-server', // プラグインの名前
      description: 'Webサーバー(Express)プラグイン', // 説明
      pluginVersion: '3.6.5', // プラグインのバージョン
      nakoRuntime: ['cnako'], // 対象ランタイム
      nakoVersion: '3.6.5' // 要求なでしこバージョン
    }
  },
  '初期化': {
    type: 'func',
    josi: [],
    pure: true,
    fn: function (sys) {
      sys.__setSysVar('WEBサーバ:ONSUCCESS', null)
      sys.__setSysVar('WEBサーバ:ONERROR', null)
      sys.__setSysVar('WEBサーバ:要求', null)
      sys.__setSysVar('WEBサーバ:応答', null)
      sys.__setSysVar('WEBサーバクエリ', {})
      sys.__server = null
      sys.__webapp = null
    }
  },
  // @HTTPサーバ(Express)
  'GETデータ': { type: 'const', value: '' }, // @GETでーた
  'POSTデータ': { type: 'const', value: '' }, // @POSTでーた
  'WEBサーバ名前設定': { // @Webサーバの名前を変更する // @WEBさーばなまえへんこう
    type: 'func',
    josi: [['に', 'へ']],
    pure: true,
    fn: function (name, sys) {
      WEBSERVER_NAME = name
      debug = false
    },
    return_none: true
  },
  'WEBサーバ起動': { // @ポートPORTNOでWebサーバを起動して成功したら『WEBサーバ起動成功した時』を実行する // @WEBさーばきどう
    type: 'func',
    josi: [['の', 'で']],
    pure: true,
    fn: function (portno, sys) {
      const app = express()
      const server = app.listen(portno, () => {
        const pno = server.address().port
        if (debug) {
          console.log('* [' + WEBSERVER_NAME + '] (debug)')
          console.log('| 以下のURLで起動しました。')
          console.log('+- [URL] http://localhost:' + pno)
        }
        const callback = sys.__getSysVar('WEBサーバ:ONSUCCESS')
        if (callback) { callback(pno, sys) }
      })
      server.on('error', (e) => {
        const callback = sys.__getSysVar('WEBサーバ:ONERROR')
        if (callback) { callback(e, sys) }
      })
      // POSTを自動的に処理
      app.use(bodyParser.text({
        type: 'text/plain'
      }))
      app.use(bodyParser.json({
        type: 'application/json'
      }))
      app.use(bodyParser.urlencoded({
        type: 'application/x-www-form-urlencoded',
        extended: true
      }))
      // memo
      sys.__webapp = app
      sys.__server = server
      return server
    }
  },
  'WEBサーバ起動時': { // @ポートPORTNOでWebサーバを起動して成功したらCALLBACKを実行する // @WEBさーばきどうしたとき
    type: 'func',
    josi: [['を'], ['の', 'で']],
    pure: false,
    fn: function (callback, portno, sys) {
      sys.__setSysVar('WEBサーバ:ONSUCCESS', callback)
      return sys.__exec('WEBサーバ起動', [portno, sys])
    }
  },
  'WEBサーバ起動成功時': { // @WEBサーバ起動が成功した時にcallbackを実行 // @WEBさーばきどうせいこうしたとき
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (callback, sys) {
      sys.__setSysVar('WEBサーバ:ONSUCCESS', callback)
    },
    return_none: true
  },
  'WEBサーバ起動失敗時': { // @WEBサーバ起動が失敗した時にcallbackを実行 // @WEBさーばきどうしっぱいしたとき
    type: 'func',
    josi: [['を']],
    pure: true,
    fn: function (callback, sys) {
      sys.__setSysVar('WEBサーバ:ONERROR', callback)
    },
    return_none: true
  },
  'WEBサーバ静的パス指定': { // @サーバのHTMLや画像などを配置する静的パスを指定する // @WEBさーばせいてきぱすしてい
    type: 'func',
    josi: [['を'], ['に', 'へ']],
    pure: true,
    fn: function (url, path, sys) {
      if (sys.__webapp == null) { throw new Error(ERROR_NO_INIT) }
      if (debug) { console.log('[static]', url, path) }
      sys.__webapp.use(url, express.static(path))
    },
    return_none: true
  },
  'WEBサーバGET時': { // @URIにGETメソッドがあった時の処理を指定 // @WEBさーばGETしたとき
    type: 'func',
    josi: [['を'], ['に', 'へ']],
    pure: true,
    fn: function (callback, uri, sys) {
      if (debug) {
        console.log('[GET] ' + uri)
      }
      sys.__webapp.get(uri, (req, res) => {
        callbackServerFunc(callback, req, res, sys)
      })
    },
    return_none: true
  },
  'WEBサーバPOST時': { // @URIにPOSTメソッドがあった時の処理を指定 // @WEBさーばPOSTしたとき
    type: 'func',
    josi: [['を'], ['に', 'へ']],
    pure: true,
    fn: function (callback, uri, sys) {
      sys.__webapp.post(uri, (req, res) => { callbackServerFunc(callback, req, res, sys) })
    },
    return_none: true
  },
  'WEBサーバPUT時': { // @URIにPOSTメソッドがあった時の処理を指定 // @WEBさーばPUTしたとき
    type: 'func',
    josi: [['を'], ['に', 'へ']],
    pure: true,
    fn: function (callback, uri, sys) {
      sys.__webapp.put(uri, (req, res) => { callbackServerFunc(callback, req, res, sys) })
    },
    return_none: true
  },
  'WEBサーバDELETE時': { // @URIにPOSTメソッドがあった時の処理を指定 // @WEBさーばDELETEしたとき
    type: 'func',
    josi: [['を'], ['に', 'へ']],
    pure: true,
    fn: function (callback, uri, sys) {
      sys.__webapp.delete(uri, (req, res) => { callbackServerFunc(callback, req, res, sys) })
    },
    return_none: true
  },
  'WEBサーバヘッダ出力': { // @クライアントにヘッダOBJを出力 // @WEBさーばへっだしゅつりょく
    type: 'func',
    josi: [['を', 'の']],
    pure: true,
    fn: function (obj, sys) {
      const res = sys.__getSysVar('WEBサーバ:応答')
      for (const key in obj) {
        res.set(key, obj[key])
      }
    },
    return_none: true
  },
  'WEBサーバステータス出力': { // @クライアントにステータスNOを出力 // @WEBさーばすてーたすしゅつりょく
    type: 'func',
    josi: [['を', 'の']],
    pure: true,
    fn: function (no, sys) {
      const res = sys.__getSysVar('WEBサーバ:応答')
      res.sendStatus(no)
    },
    return_none: true
  },
  'WEBサーバ出力': { // @クライアントにSを出力 // @WEBさーばしゅつりょく
    type: 'func',
    josi: [['を', 'と']],
    pure: true,
    fn: function (s, sys) {
      const res = sys.__getSysVar('WEBサーバ:応答')
      res.send('' + s)
    },
    return_none: true
  },
  'WEBサーバリダイレクト': { // @URLにリダイレクトする // @WEBさーばりだいれくと
    type: 'func',
    josi: [['へ', 'に']],
    pure: true,
    fn: function (url, sys) {
      const res = sys.__getSysVar('WEBサーバ:応答')
      res.redirect(302, url)
    },
    return_none: true
  }
}

// GET/POST/PUT/DELETEのコールバック
function callbackServerFunc (callback, req, res, sys) {
  // if (debug) { console.log(req) }
  sys.__setSysVar('WEBサーバ:要求', req)
  sys.__setSysVar('WEBサーバ:応答', res)
  sys.__setSysVar('GETデータ', req.query)
  sys.__setSysVar('POSTデータ', req.body)
  callback(req, res)
}

// module.exports = PluginExpress
export default PluginExpress

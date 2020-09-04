import Vue from 'vue';

import {isObject, proxy, isPromise} from './util';

import {getLogger} from "packages/logging/runtime";

const console = getLogger('${srcPath}');

function unifyObjectStyle(type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }
  return {type, payload, options}
}

export default class Store {
  constructor(options) {
    const {store, isIntercept, isStateReactive} = options;
    this._actions = Object.create(null);
    this._mutations = Object.create(null);
    // 开启后查找过程会被拦截，如果此节点动态新增字段，后代节点会得到更新
    this._isIntercept = !!isIntercept;
    // 数据本身是响应的
    this._isStateReactive = !!isStateReactive;
    let state = store && store.state && store.state() || {};// store or data
    this.setState(state);
    this.register(store);
  }

  commit(_type, _payload, _options) {
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = {type, payload}
    const entry = this._mutations[type]
    if (!entry) {
      console.error(`unknown mutation type: ${type}`)
      return
    }

    entry.forEach(function commitIterator(handler) {
      handler(payload)
    })
  }

  dispatch(_type, _payload) {
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = {type, payload}
    const entry = this._actions[type]
    if (!entry) {
      console.error(`unknown action type: ${type}`)
      return
    }
    const result = entry.length > 1
        ? Promise.all(entry.map(handler => handler(payload)))
        : entry[0](payload)

    return result;
  }

  setState(state) {
    // state变成Observable
    if (!state._isVue && !this._isStateReactive) {
      Vue.observable(state);
    }
    if (this._isIntercept) {
      this._state = Vue.observable({
        state
      });
      state = this._state;
      proxy(this, "_state", "state");
    } else {
      this.state = state;
    }
  }

  register(config) {
    if (!config) {
      return;
    }
    config.mutations && Object.keys(config.mutations).forEach((mutation) => {
      this.registerMutation(mutation, config.mutations[mutation])
    });
    config.actions && Object.keys(config.actions).forEach((action) => {
      this.registerAction(action, config.actions[action])
    });
  }

  registerMutation(type, handler) {
    let self = this;
    const entry = this._mutations[type] || (this._mutations[type] = [])
    entry.push(function wrappedMutationHandler(payload) {
      handler.call(self, self.state, payload)
    })
  }

  registerAction(type, handler) {
    var self = this;
    const entry = this._actions[type] || (this._actions[type] = [])
    entry.push(function wrappedActionHandler(payload) {
      let res = handler.call(self, {
        dispatch: self.dispatch.bind(self),
        commit: self.commit.bind(self),
        state: self.state
      }, payload);
      if (!isPromise(res)) {
        res = Promise.resolve(res)
      }
      return res
    })
  }
}

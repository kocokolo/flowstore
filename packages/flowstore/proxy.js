import {NAME_PRE} from './config';
import {resolveVariable} from 'packages/tpl/tpl-builtin';

import {getLogger} from "packages/logging/runtime";

const console = getLogger('${srcPath}');

let properties = {
  '__super': {// 特殊属性，访问上级
    writable: true,
    enumerable: false
  },
  '_isVue': { // vue中禁止被observer
    value: true,
    writable: true,
    enumerable: false
  }
};

const UnSet = Symbol("UnSet");

export default function ProxyState(flow) {
  const proxyObj = Object.create({}, {
    ...properties
  });
  const getVal = function (prop) {
    if (prop == "__super") {// 特殊属性
      return flow._parentFlow;
    }
    if (typeof prop == "string" && prop.startsWith(NAME_PRE)) {// 指定节点名称查找
      return flow.findStore(prop.replace(new RegExp(`^${NAME_PRE}`), ""));
    }
    let val = UnSet; // 默认"未设置"
    if (prop in flow) {// 自身的方法和属性，like "newObject"
      val = flow[prop];
      if (typeof val == "function") {
        val = val.bind(flow);
      }
      return val;
    }
    let state = flow.state;
    if (state.hasOwnProperty(prop)) {// 从state中查找
      if (flow._isMapping) {
        val = resolveVariable(state[prop], flow._parentFlow);
      } else {
        val = state[prop];
      }
    } else if (flow._parentFlow && !flow._localed) {// 向上查找
      val = flow._parentFlow[prop];
    }
    return val;
  }
  const handler = {
    // .xxx [xxx]
    get: function (origin, prop) {
      var val = getVal(prop);
      if (val == UnSet) {
        val = undefined;
      }
      return val;
    },
    // in 
    has(target, key) {
      var val = getVal(key);
      if (val !== UnSet) {
        return true;
      }
      return false;
    },
    // hasOwnProperty getOwnPropertyDescriptor
    getOwnPropertyDescriptor(target, property) {
      return Object.getOwnPropertyDescriptor(flow.state, property)
    },
    // keys() {...} 
    ownKeys() {
      // @important 占坑，但不赋值，从而支持(遍历{...},hasOwnProperty,Object.keys等)
      // detail :https://blog.csdn.net/weixin_43513495/article/details/99444827
      // 先清理
      Object.keys(proxyObj).forEach(function (key) {
        delete proxyObj[key];
      });
      // 再新增
      Object.keys(flow.state).map(function (key) {
        proxyObj[key] = UnSet;
      });
      // 这样返回的key外界才能访问到
      return Reflect.ownKeys(proxyObj);
    },
    // not-support
    set: function (target, key, value) {
      console.warn(`proxyObj ${key} 无效更改`);
      return true;
    }
  };
  return new Proxy(proxyObj, handler);
}

export function ProxyChild(flow, fieldName) {
  var self = flow;
  const proxyObj = Object.create({}, {
    ...properties
  });
  const handler = {
    get: function (origin, prop) {
      // todo perf
      if (self.state && self.state[fieldName]) {
        return self.state[fieldName][prop];
      }
      return proxyObj[prop];
    },
    // in 
    has(target, key) {
      // todo perf
      if (self.state && (key in self.state[fieldName])) {
        return true;
      }
      return false;
    },
    // hasOwnProperty getOwnPropertyDescriptor
    getOwnPropertyDescriptor(target, property) {
      if (self.state && self.state[fieldName]) {
        return Object.getOwnPropertyDescriptor(self.state[fieldName], property)
      }
    },
    ownKeys() {
      // todo perf
      Object.keys(proxyObj).forEach(function (key) {
        delete proxyObj[key];
      })
      Object.keys(self.state[fieldName]).map(function (key) {
        proxyObj[key] = UnSet;
      });
      return Reflect.ownKeys(proxyObj);
    },
    set: function (target, key, value) {
      proxyObj[key] = value;
      console.info(`proxyObj ${key} 被非法更改`);
      return true;
    }
  };
  let p = new Proxy(proxyObj, handler);
  return p;
}

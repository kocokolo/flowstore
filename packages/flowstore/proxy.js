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

function commonGetterState(store, prop) {
  var state = store._getState();
  var val = UnSet;
  if (state && state.hasOwnProperty(prop)) {// 从state中查找
    if (store._isMapping) {
      val = resolveVariable(state[prop], store._parentFlow);
    } else {
      val = state[prop];
    }
  }
  return val;
}

function commonGetter(store, proxyObj, prop) {
  // 默认"未设置"
  var val = UnSet;
  if (prop == "__super") {// 特殊属性
    return store._parentFlow;
  }
  if (prop == "_isVue") {// 特殊属性
    return true;
  }
  if (typeof prop == "string" && prop.startsWith(NAME_PRE)) {// 指定节点名称查找
    return store.findStore(prop.replace(new RegExp(`^${NAME_PRE}`), ""));
  }
  if (prop in Object.prototype) {// 原型上的方法和属性，如hasOwnProperty
    val = Object.prototype[prop];
  } else if (prop in store) {// 自身的方法和属性，class(flow class ,store class ) 上的方法 createObject,state
    val = store[prop];
    if (typeof val == "function") {
      val = val.bind(store);
    }
  } else if (proxyObj.hasOwnProperty(prop) && proxyObj[prop] != UnSet) {// 自定义的属性
    val = proxyObj[prop];
  }
  return val;
}

function commonSetter(proxyObj, prop, value) {
  proxyObj[prop] = value;
  console.warn(`${prop}字段被非法更改，不建议直接修改proxy里的数据，请检查`);
  return true;
}

function commonGetterParent(store, prop) {
  if (store._parentFlow && !store._localed) {// 向上查找
    return store._parentFlow[prop];
  }
  // 默认"未设置"
  return UnSet;
}

function commonGetOwnPropertyDescriptor(state, prop) {
  if (properties[prop]) {
    return properties[prop];
  }
  return Object.getOwnPropertyDescriptor(state, prop);
}

const UnSet = Symbol("UnSet");

/**
 * 普通的代理访问
 * @param store
 * @returns {PropertyDescriptor|PropertyKey[]|boolean|any}
 * @constructor
 */
export default function ProxyState(store) {
  const proxyObj = Object.create({}, {
    ...properties
  });
  const getVal = function (prop) {
    let val = commonGetter(store, proxyObj, prop);
    if (val !== UnSet) {
      return val;
    } else {
      val = commonGetterState(store, prop);
      if (val == UnSet) {
        val = commonGetterParent(store, prop);
      }
    }
    if (val == UnSet) {
      return undefined;
    }
    return val;
  }
  const handler = {
    // .xxx [xxx]
    get: function (origin, prop) {
      var val = getVal(prop);
      return val;
    },
    // not-support
    set: function (target, key, value) {
      return commonSetter(proxyObj, key, value);
    },
    // in 
    has(target, key) {
      if (key in store._getState()) {
        return true;
      }
      if (store._parentFlow) {
        return key in store._parentFlow;
      }
      return false;
    },
    //对外 hasOwnProperty 用, ownKeys里的key都需要有，否则遍历会报错
    getOwnPropertyDescriptor(target, prop) {
      return commonGetOwnPropertyDescriptor(store._getState(), prop);
    },
    // keys() {...} 
    ownKeys() {
      // @important 占坑，但不赋值，从而支持(遍历{...},hasOwnProperty,Object.keys等)
      // detail :https://blog.csdn.net/weixin_43513495/article/details/99444827
      // 先清理
      Object.keys(proxyObj).forEach(function (key) {
        if (proxyObj[key] == UnSet) {
          delete proxyObj[key];
        }
      });
      // 再新增
      Object.keys(store._getState()).map(function (key) {
        proxyObj[key] = UnSet;
      });
      // 这样返回的key外界才能访问到
      return Reflect.ownKeys(proxyObj);
    }
  };
  return new Proxy(proxyObj, handler);
}

/**
 * 将多个store代理为一个
 * @param store
 * @returns {*|PropertyDescriptor|PropertyKey[]|boolean|any}
 * @constructor
 */
export function ProxyChildren(store) {
  const proxyObj = Object.create({}, {
    ...properties
  });
  const getVal = function (prop) {
    let val = commonGetter(store, proxyObj, prop);
    if (val !== UnSet) {
      return val;
    }
    let childFlows = (store._childFlows || []).concat([]).reverse();
    let state;
    let foundFlow;
    childFlows.find(function (flow) {
      let st = flow && flow._getState();
      if (st && st.hasOwnProperty(prop)) {
        state = st;
        foundFlow = flow;
        return true;
      }
    });
    if (state) {// 从state中查找
      if (foundFlow._isMapping) {
        val = resolveVariable(state[prop], foundFlow._parentFlow);
      } else {
        val = state[prop];
      }
    }
    if (val == UnSet) {
      val = commonGetterParent(store, prop);
    }
    if (val == UnSet) {
      return undefined;
    }
    return val;
  }
  const handler = {
    // .xxx [xxx]
    get: function (origin, prop) {
      var val = getVal(prop);
      return val;
    },
    set: function (target, key, value) {
      return commonSetter(proxyObj, key, value);
    },
    // in for..of
    has(target, key) {
      let childFlows = store._childFlows || [];
      let flow = childFlows.find(function (_flow) {
        return key in _flow._getState();
      });
      if (flow) {
        return true;
      }
      if (store._parentFlow) {
        return key in store._parentFlow;
      }
      return false;
    },
    // hasOwnProperty 用, ownKeys里的key都需要有，否则遍历会报错
    getOwnPropertyDescriptor(target, prop) {
      if (properties[prop]) {
        return properties[prop];
      }
      let childFlows = store._childFlows || [];
      let foundFlow = childFlows.find(function (flow) {
        return flow.hasOwnProperty(prop)
      });
      return foundFlow && Object.getOwnPropertyDescriptor(foundFlow, prop)
    },
    // keys() {...} 
    ownKeys() {
      // @important 占坑，但不赋值，从而支持(遍历{...},hasOwnProperty,Object.keys等)
      // detail :https://blog.csdn.net/weixin_43513495/article/details/99444827
      // 先清理
      Object.keys(proxyObj).forEach(function (key) {
        if (proxyObj[key] == UnSet) {// 自定义属性要保留
          delete proxyObj[key];
        }
      });
      // 再新增
      let childFlows = store._childFlows || [];
      childFlows.forEach(function (flow) {
        Object.keys(flow).map(function (key) {
          proxyObj[key] = UnSet;
        });
      });
      // 这样返回的key外界才能访问到
      return Reflect.ownKeys(proxyObj);
    }
  };
  return new Proxy(proxyObj, handler);
}

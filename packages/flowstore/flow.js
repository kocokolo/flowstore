import Store from './store';

import ProxyState, {ProxyChildren} from './proxy';

import {getLogger} from "packages/logging/runtime";

const console = getLogger('${srcPath}');

// 本质是一个随<时间变化/组件管理>的实现作用域功能的动态链表 

// 1、构建flow过程不要造成访问，防止数据改变，flow重建，导致全更新
// 2、get查找过程不要造成不必要的访问 , 导致多更新
// 3、每次都创建新flow，不能影响已经创建的flow

// 拷贝一个新flow
function getFLowStoreOptions(self) {
  return {
    ...self._options,
    store: {
      ...self._options.store,
      state() {
        return self.state;
      }
    },
    name: self._name,
    isMapping: self._localed,
    localed: self._isMapping,
  }
}

function simpleOptions(options) {
  if (options && !options.store) {// options可能是一个简单对象，不需要管理功能 ，简单区分一下
    let state = options;
    options = {
      store: {
        state() {
          return state;
        }
      }
    }
  }
  return options;
}

export default class FLowStore extends Store {
  constructor(parentFlow, options = {}) {
    const {name, store, localed, isJoined, path, childFlows, isMapping} = options;
    super(options);
    this._options = options;
    // 是否是本地化的store
    this._localed = !!localed;
    // 是否是mapping的store
    this._isMapping = !!isMapping
    // parentFlow
    this._parentFlow = parentFlow;
    // 是否多个childflow共同协作
    this._isJoined = !!isJoined;
    // 是否分发
    this._path = path;
    // 子flows
    this._childFlows = childFlows || [];
    // 当前flow
    this._flow = this._makeFlow();
    let idx = parentFlow && parentFlow.addChildFlow(this._flow);
    // Store节点名称
    if (name) {
      this._name = name;
    } else if (idx) {
      this._name = (parentFlow._name || "") + "/" + idx;
    }
    return this._flow; // 注意：此处返回的是被代理过的storeflow
  }

  // 利用proxy技术将store转换成"flowstore"
  _makeFlow() {
    return this._isJoined ? ProxyChildren(this) : ProxyState(this);
  }

  // 获取当前store的state , 用于代理到flow上访问state
  _getState() {
    let state = this.state;
    if (this._path != null) {
      // todo perf 此处造成了访问
      return this._parentFlow[this._path];
      // var paths = [];
      // let temp = this;// this is a store
      // do {
      //   if (temp._path != null) {
      //     paths.unshift(temp._path);
      //   } else {
      //     break;
      //   }
      //   temp = temp._parentFlow; // this is a flow
      // } while (temp);
      // let found = paths.every(function (path) {
      //   if (state && state.hasOwnProperty(path)) {
      //     state = state[path];
      //     return true;
      //   }
      //   return false;
      // });
      // if (!found) {
      //   return {}
      // }
    }
    return state;
  }

  addChildFlow(flow) {
    this._childFlows.push(flow);
    return this._childFlows.length - 1;
  }

  removeChildFlow(delFlow) {
    let idx = this._childFlows.findIndex(flow => flow == delFlow);
    ~idx && this._childFlows.splice(idx, 1);
    return true;
  }

  getChildFlow(idx) {
    return this._childFlows[idx];
  }

  /**
   * 设置为局部的节点
   */
  setLocaled(localed, copyOptions) {
    if (copyOptions) {
      let self = this;
      return new FLowStore(this._parentFlow, {
        ...getFLowStoreOptions(self),
        localed: localed,
        ...copyOptions
      })
    } else {
      this._localed = localed;
      return self;
    }
  }

  /**
   * 查找一个节点
   * @param name
   * @returns {undefined|*}
   */
  findStore(name) {
    let flow = null;
    let temp = this;
    do {
      if (temp._name == name) {
        flow = temp
        break;
      }
      temp = temp._parentFlow
    } while (temp) ;
    if (!flow) {
      return undefined;
    } else {
      return flow._flow;
    }
  }

  /**
   * 创建新的节点
   * optional：带节点状态管理功能
   */
  createStore(options) {
    options = simpleOptions(options);
    return new FLowStore(this._flow, options);
  }

  // flow： a -- b => insert c => flow1: a -- c -- b
  /**
   * 向上插入一个节点
   * @param options
   * @returns {FLowStore}
   */
  inertStore(options) {
    options = simpleOptions(options);
    let self = this;
    let flow = new FLowStore(self._parentFlow, options);
    // 需要重新创建一个新节点，不能直接修改原来的节点
    flow = new FLowStore(flow, {
      ...getFLowStoreOptions(self)
    });
    return flow;
  }

  /**
   * 自定义数据映射
   * @param mapping
   * @returns {FLowStore|*}
   */
  mappingStore(mapping) {
    return new FLowStore(this._flow, {
      isMapping: true,
      store: {
        state() {
          return mapping;
        }
      }
    });
  }

  joinStore(stores) {
    let self = this;
    let joinFlow = new FLowStore(this._flow, {
      isJoined: true
    });

    stores && stores.forEach(function (options) {
      options = simpleOptions(options);
      let flow = new FLowStore(joinFlow, options);
      joinFlow.addChildFlow(flow);
    });

    return joinFlow;
  }

  /**
   * 将当前设置的状态提前
   * @param fieldName 对象的属性或者数组的index
   * @returns {FLowStore|...*}
   */
  pickStore(path) {
    let self = this;
    return new FLowStore(this._flow, {
      path: path,
      store: {
        state() {
          return self.state;
        }
      }
    });
  }
}


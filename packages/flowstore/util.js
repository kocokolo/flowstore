export function isObject(obj) {
  return obj !== null && typeof obj === 'object'
}

export function isPromise(val) {
  return val && typeof val.then === 'function'
}

export function assert(condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

function getNestedState(state, path) {
  return path.reduce((state, key) => state[key], state)
}

export function partial(fn, arg) {
  return function () {
    return fn(arg)
  }
}

// obj[source] 会触发 vue getter , 此种情况不会触发
function getObj(obj, paths) {
  obj = paths.reduce(function (o, source) {
    if (!o) {
      return null;
    }
    let des = Reflect.getOwnPropertyDescriptor(o, source);
    let value = des && des.value;
    return value;
  }, obj);
  return obj;
}

export function getSourceKeys(obj, paths) {
  obj = getObj(obj, paths);
  return obj && Object.keys(obj);
}

export function checkSourceHas(obj, paths, property) {
  // obj[source] 会触发 vue getter
  obj = getObj(obj, paths);
  return obj && obj.hasOwnProperty(property);
}

var sharedPropertyDefinition = {
  enumerable: true,
  configurable: true
};

// 为了将整个对象变成可响应的，一般会提升一下级别，导致访问路径改变，通过proxy可以类似于没有提升
export function proxy(target, sourceKey, key) {
  sharedPropertyDefinition.get = function proxyGetter() {
    return this[sourceKey][key]
  };
  sharedPropertyDefinition.set = function proxySetter(val) {
    this[sourceKey][key] = val;
  };
  Object.defineProperty(target, key, sharedPropertyDefinition);
}

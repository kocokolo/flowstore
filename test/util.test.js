import {checkSourceHas} from "packages/flowstore/util";

function def(obj, key) {
  var val = obj[key];
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      return val
    },
    set: function reactiveSetter(newVal) {
      val = newVal;
    }
  })
}

test('simple1', async () => {
  var demo = {
    a: {
      b: {
        c: {
          d: {
            name: 111
          }
        }
      }
    }
  }
  var hs = checkSourceHas(demo, ["a", "b", "c"], "d")
  expect(hs).toEqual(true);
  hs = checkSourceHas(demo, ["a", "b"], "d")
  expect(hs).toEqual(false);
});

test('simple2', async () => {
  var AA = Object.create({});
  AA.a = 1;
  def(AA, "a")

  var BB = Object.create(AA);
  BB.b = 2;
  def(BB, "b")

  var CC = Object.create(BB);
  CC.c = 3;
  CC.a = 4;
  CC.d = 5;
  expect(CC.hasOwnProperty("c")).toEqual(true);
  expect(CC.hasOwnProperty("a")).toEqual(false);
  expect(CC.hasOwnProperty("d")).toEqual(true);

  var CC = {};
  CC.c = 3;
  CC.a = 4;
  CC.d = 5;
  expect(CC.hasOwnProperty("c")).toEqual(true);
  expect(CC.hasOwnProperty("a")).toEqual(true);
  expect(CC.hasOwnProperty("d")).toEqual(true);
});

test("用到的proxy姿势是否正确", () => {
  var proxyObj = {};
  var state = {a: 1, b: 2}
  var sync = function () {
    Object.keys(proxyObj).forEach(function (key) {
      delete proxyObj[key];
    });
    Object.keys(state).map(function (key) {
      proxyObj[key] = undefined;
    });
  }
  var handler = {
    get: function (origin, prop) {
      if (state) {
        return state[prop];
      }
      return proxyObj[prop];
    },
    ownKeys() {
      // console.log("🦁️🦁️🦁️🦁️ownKeys🦁️🦁️🦁️");
      sync();
      return Reflect.ownKeys(proxyObj);
    },
    has(target, key) {
      // console.log("🦁️🦁️🦁️🦁has🦁️🦁️🦁️");
      if (key in state) {
        return true;
      }
      return false;
    },
    getOwnPropertyDescriptor(target, property) {
      // console.log("🦁️🦁️🦁️🦁getOwnPropertyDescriptor🦁️🦁️🦁️");
      return Object.getOwnPropertyDescriptor(state, property);
    },
    set: function (target, key, value) {
      return true;
    }
  };
  let p = new Proxy(proxyObj, handler);
  expect("a" in p).toEqual(true);
  expect("c" in p).toEqual(false);
  expect(p.hasOwnProperty("a")).toEqual(true);
  expect(p.hasOwnProperty("c")).toEqual(false);
  expect(Object.keys(p)).toEqual(["a", "b"]);
  state = {c: 2}
  expect(Object.keys(p)).toEqual(["c"]);
  expect(p.hasOwnProperty("a")).toEqual(false);
  expect(p.hasOwnProperty("c")).toEqual(true);
  expect("a" in p).toEqual(false);
  expect("c" in p).toEqual(true);
});

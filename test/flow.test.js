import Vue from 'vue';
import MakeFlowStore from 'packages/flowstore';
import {checkSourceHas} from 'packages/flowstore/util';
import {NAME_PRE} from 'packages/flowstore/config';

async function watcher(getter, setter, vm) {
  var val = await new Promise(function (resolve, reject) {
    var vm = vm || new Vue({});
    let _t;
    let watcher = vm.$watch(getter, function (newVal) {
      clearTimeout(_t)
      resolve && resolve(newVal);
      watcher();
    }, {
      immediate: false
    });
    setter();
    _t = setTimeout(function () {
      resolve = null;
      reject("error");
    }, 10);
  });
  return val;
}

test('simple1', () => {
  let store = {
    state() {
      return {
        a: 1
      };
    },
    mutations: {
      setA(state, a) {
        state.a = a;
      }
    },
    actions: {
      setA({dispatch, commit}, a) {
        commit("setA", a);
      }
    }
  };
  let flow = MakeFlowStore({
    name: "top",
    store
  });
  expect(flow.a).toEqual(1);
  expect(flow[NAME_PRE + "top"].a).toEqual(1);
  flow.dispatch("setA", 123);
  expect(flow.a).toEqual(123);
  expect(Object.keys(flow)).toEqual(["a"]);
  expect({...flow}).toEqual({a: 123});
  expect(flow[NAME_PRE + "top"].a).toEqual(123);
});

test('simple2', () => {
  let store1 = {
    state() {
      return {
        a: 11,
        b: 12
      };
    },
    mutations: {
      setA(state, a) {
        state.a = a;
      }
    }
  };
  let store2 = {
    state() {
      return {
        b: 22,
        c: 23,
        d: 24
      };
    },
    mutations: {
      set(state, {name, value}) {
        if (state.hasOwnProperty(name)) {
          state[name] = value;
        } else {
          Vue.set(state, name, value);
        }
      }
    }
  };
  let flow1 = MakeFlowStore({
    name: "Store1",
    store: store1
  });
  let flow2 = flow1.createStore({
    name: "Store2",
    store: store2
  });
  expect("a" in flow2).toEqual(true);
  expect(flow1.hasOwnProperty("a")).toEqual(true);
  expect(flow2.hasOwnProperty("a")).toEqual(false);
  // flow2.a = 123;
  // expect(flow2.hasOwnProperty("a")).toEqual(true);
  expect(flow2.a).toEqual(11);
  expect(flow2.b).toEqual(22);
  expect(flow2[NAME_PRE + "Store1"].b).toEqual(12);
  expect(flow2[NAME_PRE + "Store2"].b).toEqual(22);
  expect(flow2.findStore("Store1").b).toEqual(12);
  expect(flow2.findStore("Store2").b).toEqual(22);
  flow1.commit("setA", 100);
  expect(flow2.a).toEqual(100);
  flow2.commit("set", {name: "a", value: 200});
  expect(flow2.a).toEqual(200);
});

test('simple3', () => {
  let store = {
    state() {
      return {
        person: {
          name: 111,
          age: 222
        }
      };
    }
  };
  let flow = MakeFlowStore({
    store
  }).pickStore("person").createStore({
    test: 'test'
  });
  expect(flow.test).toEqual('test');
  expect(flow.name).toEqual(111);
  expect(flow.person.age).toEqual(222);
  expect(flow.age).toEqual(222);
  expect(flow.person).toEqual({
    name: 111,
    age: 222
  });
});

test('simple4', () => {
  let store = {
    state() {
      return {
        aaa: 1,
        data: [{
          name: "aaa",
          age: 11
        },
          {
            name: "bbb",
            age: 22
          }]
      };
    }
  };
  let flow = MakeFlowStore({store});
  flow = flow.pickStore("data");
  // expect(flow[1].name).toEqual("bbb");
  flow = flow.pickStore(0);
  expect(flow.name).toEqual("aaa");
  expect(flow.aaa).toEqual(1);
  expect(flow[1].name).toEqual("bbb");
  expect(flow.data[1].name).toEqual("bbb");
  flow = flow.createStore({
    store: {
      state() {
        return {
          test: 123
        }
      },
      mutations: {
        setTest(state, test) {
          state.test = test;
        }
      }
    }
  });
  expect(flow.test).toEqual(123);
  flow.commit("setTest", 12343);
  expect(flow.test).toEqual(12343);
});

test('simple5', () => {
  let store = {
    state() {
      return [
        {
          a: 1
        },
        {
          a: 2
        }
      ];
    }
  };
  let flow = MakeFlowStore({store});
  let flow1 = flow.pickStore(0);
  let flow2 = flow.pickStore(1);
  let flow3 = flow.pickStore(1112);
  expect(flow[0].a).toEqual(1);
  expect(flow1.a).toEqual(1);
  expect(flow2.a).toEqual(2);
  expect(flow3.a).toEqual(undefined);
});

test('complex pickstore', async () => {
  let store = {
    state() {
      return [
        {
          a: 11
        },
        {
          a: 22
        },
        {
          a: 1,
          child: {
            b: 2,
            "childs": [
              {
                c: 3
              }
            ]
          }
        }
      ];
    }
  };
  let flow = MakeFlowStore({
    isIntercept: true,
    store
  });
  let flow2 = flow.pickStore(2).pickStore("child").createStore({
    store: {
      state() {
        return {
          insert1: 1
        }
      },
    }
  }).pickStore("childs").pickStore(0);
  var calc = function () {
    return flow2.a + flow2.b + flow2.c;
  };
  expect(calc()).toEqual(6);
  var val = await watcher(calc, function () {
    flow.state[2].a = 20;
    flow.state[2].child.b = 30;
    flow.state[2].child.childs[0].c = 50;
  });
  expect(flow2.insert1).toEqual(1);
  expect(val).toEqual(100);
  // todo
  var val = await watcher(function () {
    let val = flow2.m;
    return val;
  }, function (state) {
    Vue.set(flow.state[2], "m", 122);
  });
  expect(val).toEqual(122);
});

test('simple6', () => {
  let flow = MakeFlowStore({
    top: 1,
    c: 2
  });
  let flow1 = flow.createStore({a: 1});
  let flow2 = flow1.inertStore({a: 2, c: 5});
  expect(flow2.a).toEqual(1);
  expect(flow1.c).toEqual(2);
});

test('joinStore', () => {
  let flow = MakeFlowStore({
    top: 1,
    c: 2
  }).joinStore([{a: 1, c: 3}, {a: 2}]);
  expect(flow.a).toEqual(2);
  expect(flow.c).toEqual(3);
  expect(Object.keys(flow)).toEqual(["a", "c"]);
  expect(flow.hasOwnProperty("c")).toEqual(true);
  expect(flow.hasOwnProperty("top")).toEqual(false);
  expect({...flow}).toEqual({"a": 2, "c": 3});
  expect("top" in flow).toEqual(true);
  expect("c" in flow).toEqual(true);
  expect("a" in flow).toEqual(true);
  expect("cccc" in flow).toEqual(false);
});

test('isStateReactive state', async () => {
  var vm = new Vue({
    data() {
      var data = {
        a: 1
      };
      return data;
    },
    computed: {
      flow() {
        var self = this;
        return MakeFlowStore({
          isStateReactive: true,
          store: {
            state() {
              return self.$data;
            }
          }
        });
      }
    }
  });
  expect(vm.flow.a).toEqual(1);
  var val = await watcher(function () {
    return vm.flow.a;
  }, function () {
    vm.$data.a = 100;
  }, vm);
  expect(val).toEqual(100);
  expect(vm.flow.a).toEqual(100);
});

test('isStateReactive state 2', async () => {
  var vm = new Vue({
    data() {
      var data = {
        a: {
          a: 1
        }
      };
      return data;
    },
    render(h) {
      console.log("render b", this.flow.a.b);
    },
    computed: {
      flow() {
        var self = this;
        return MakeFlowStore({
          isStateReactive: true,
          isIntercept: true,
          store: {
            state() {
              return self.$data;
            }
          }
        });
      }
    }
  });
  vm.$mount();
  expect(vm.flow.a.a).toEqual(1);
  var val = await watcher(function () {
    return vm.flow.a.b;
  }, function () {
    Vue.set(vm.$data.a, "b", 2);
  }, vm);
  expect(val).toEqual(2);
  expect(vm.flow.a.b).toEqual(2);
});

test('simple7', async () => {
  var flow1 = MakeFlowStore({
    store: {
      state() {
        return {
          a: 1
        }
      },
      mutations: {
        setTest(state, a) {
          state.a = a;
        }
      }
    }
  });
  var flow2 = flow1.createStore({
    store: {
      state() {
        return {
          b: 2
        };
      }
    }
  });
  var flow3 = flow2.mappingStore({
    "c": "${a}",
    "d": "${b}"
  });
  expect(flow3.c).toEqual(1);
  expect(flow3.d).toEqual(2);
  var val = await watcher(function () {
    return flow3.c;
  }, function () {
    flow1.commit("setTest", 100);
  })
  expect(val).toEqual(100);
});

test('simple8', async () => {
  var flow1 = MakeFlowStore({
    store: {
      state() {
        return {
          a: 1
        }
      },
      mutations: {
        setTest(state, a) {
          state.a = a;
        }
      }
    }
  });
  var flow2 = flow1.createStore({
    store: {
      state() {
        return {
          b: 2
        };
      }
    }
  });
  var flow3 = flow2.mappingStore({
    "c": "${a}",
    "d": "${b}"
  });
  expect(flow3.c).toEqual(1);
  expect(flow3.d).toEqual(2);
  var val = await watcher(function () {
    return flow3.c;
  }, function () {
    flow1.commit("setTest", 100);
  });
  expect(val).toEqual(100);
});

test('simple9', async () => {
  // 开启isIntercept能监听到新增数据变化
  var flow = MakeFlowStore({
    isIntercept: true,
    store: {
      state() {
        return {}
      },
      mutations: {
        setTest(state, test) {
          Vue.set(state, "test", test);
        }
      }
    }
  });

  var val = await watcher(function () {
    return flow.test;
  }, function () {
    flow.commit("setTest", 2);
  });
  expect(val).toEqual(2);
  // 不开启isIntercept不能监听到新增数据变化
  var flow = MakeFlowStore({
    isIntercept: false,
    store: {
      state() {
        return {}
      },
      mutations: {
        setTest(state, test) {
          Vue.set(state, "test", test);
        }
      }
    }
  });
  try {
    var val = await watcher(function () {
      return flow.test;
    }, function () {
      flow.commit("setTest", 2);
    });
  } catch (e) {
    expect(e).toEqual('error');
  }
}, 2000);

test('数据改变，自动更新', async () => {
  var flow = MakeFlowStore({
    store: {
      state() {
        return {
          test: 11,
          aaa: {}
        }
      },
      mutations: {
        setTest(state, test) {
          // Vue.set(state, "test", test)
          Vue.set(state.aaa, "test", test)
        }
      }
    }
  });
  expect(flow.aaa.test).toEqual(undefined);
  var val = await watcher(function () {
    return flow.aaa.test;
  }, function () {
    flow.commit("setTest", 22);
  });
  expect(val).toEqual(22);
  expect(flow.aaa.test).toEqual(22);
});

test('父级数据改变，自动更新', async () => {
  var flow = MakeFlowStore({
    store: {
      state() {
        return {
          test: 11,
          aaa: {}
        }
      },
      mutations: {
        setTest(state, test) {
          // Vue.set(state, "test", test)
          Vue.set(state.aaa, "test", test)
        }
      }
    }
  });
  var flow2 = flow.createStore({
    store: {
      state() {
        return {};
      }
    }
  });
  expect(flow2.aaa.test).toEqual(undefined);
  var val = await watcher(function () {
    return flow2.aaa.test;
  }, function () {
    flow.commit("setTest", 22);
  });
  expect(val).toEqual(22);
  expect(flow2.aaa.test).toEqual(22);
});

test('父级数据改变，自动更新 (pickStore)', async () => {
  var flow = MakeFlowStore({
    store: {
      state() {
        return {
          test: 11,
          aaa: {}
        }
      },
      mutations: {
        setTest(state, test) {
          Vue.set(state, "test", test * 2)
          Vue.set(state.aaa, "test", test)
        }
      }
    }
  });
  // pickStore之后需要保留联系
  var flow2 = flow.pickStore("aaa");
  flow2.setLocaled(true);
  expect(flow2.test).toEqual(undefined);
  var val = await watcher(function () {
    return flow2.test;
  }, function () {
    flow.commit("setTest", 22);
  });
  expect(val).toEqual(22);
  expect(flow2.test).toEqual(22);
  expect(flow.test).toEqual(44);
});

test('父级数据改变，自动更新 (pickStore)', async () => {
  var flow = MakeFlowStore({
    store: {
      state() {
        return {
          aaa: {}
        }
      },
      mutations: {
        setTest(state, test) {
          Vue.set(state.aaa, "test", test)
        }
      }
    }
  });
  // pickStore之后需要保留联系
  var flow2 = flow.pickStore("aaa");
  flow2.setLocaled(true);
  expect(flow2.test).toEqual(undefined);
  var val = await watcher(function () {
    return flow2.test;
  }, function () {
    flow.commit("setTest", 22);
  });
  expect(flow2.test).toEqual(22);
});

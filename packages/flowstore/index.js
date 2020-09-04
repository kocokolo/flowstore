import FLowStore from './flow';

let rootState = {};

const RootFlowStore = new FLowStore(null, {
  name: 'ROOT',
  store: {
    state() {
      return rootState;
    }
  }
});

global.__debugRootState = rootState;

export default function (options) {
  return RootFlowStore.createStore(options);
}

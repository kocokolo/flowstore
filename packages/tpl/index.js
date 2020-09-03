import {getLogger} from 'packages/logging/runtime';

const logger = getLogger('${srcPath}');

const enginers = {};

export function reigsterTplEnginer(name, enginer) {
  enginers[name] = enginer;
}

export function filter(tpl, data) {
  if (!tpl || typeof tpl !== 'string') {
    return '';
  }
  let keys = Object.keys(enginers);
  for (let i = 0, len = keys.length; i < len; i++) {
    let enginer = enginers[keys[i]];
    if (enginer.test(tpl)) {
      try {
        let v = enginer.compile(tpl, data);
        // logger.info(tpl, data, v);
        return v;
      } catch (e) {
        logger.info(e.message, tpl, data);
        return '';
      }
    }
  }
  return tpl;
}

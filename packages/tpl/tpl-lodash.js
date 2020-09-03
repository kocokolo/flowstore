import {reigsterTplEnginer, filter} from "./";
import template from 'lodash/template';
import * as lodash from 'lodash';

import {filters} from "./tpl-builtin";
import moment from 'moment';

const imports = {
  ...filters,
  formatTimeStamp: filters.date,
  formatNumber: filters.number,
  defaultValue: filters.default,
  default: undefined,
  moment: moment,
  countDown: (end) => {
    if (!end) {
      return '--';
    }

    let date = new Date(parseInt(end, 10) * 1000);
    let now = Date.now();

    if (date.getTime() < now) {
      return '已结束';
    }

    return Math.ceil((date.getTime() - now) / (1000 * 60 * 60 * 24)) + '天';
  },
  _: lodash,
  formatDate: (value, format = 'LLL', inputFormat = '') => moment(value, inputFormat).format(format)
};
delete imports.default; // default 是个关键字，不能 imports 到 lodash 里面去。
function lodashCompile(str, data) {
  try {
    const fn = template(str, {
      imports: imports,
      variable: 'data'
    });

    return fn(data);
  } catch (e) {
    return `${e.message}`;
  }
}

reigsterTplEnginer("lodash", {
  test: str => !!~str.indexOf("<%"),
  compile: (str, data) => lodashCompile(str, data)
});

/**
 * 数据模版引擎
 */
import moment from "moment";
import isPlainObject from "lodash/isPlainObject";
import {createObject, isObject, setVariable} from "packages/utils";
import {reigsterTplEnginer, filter} from "./";

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

export const prettyBytes = (num) => {
  if (!Number.isFinite(num)) {
    throw new TypeError(`Expected a finite number, got ${typeof num}: ${num}`);
  }

  const neg = num < 0;

  if (neg) {
    num = -num;
  }

  if (num < 1) {
    return (neg ? '-' : '') + num + ' B';
  }

  const exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), UNITS.length - 1);
  const numStr = Number((num / Math.pow(1000, exponent)).toPrecision(3));
  const unit = UNITS[exponent];

  return (neg ? '-' : '') + numStr + ' ' + unit;
}

const entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};

export const escapeHtml = (str) =>
  String(str).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    }
  );

export function formatDuration(value) {
  const unit = ["秒", "分", "时", "天", "月", "季", "年"];
  const steps = [1, 60, 3600, 86400, 2592000, 7776000, 31104000];
  let len = steps.length;
  const parts = [];

  while (len--) {
    if (steps[len] && value >= steps[len]) {
      parts.push(Math.round(value / steps[len]) + unit[len]);
      value %= steps[len];
    } else if (len === 0 && value) {
      parts.push((value.toFixed ? value.toFixed(2) : "0") + unit[0]);
    }
  }

  return parts.join("");
}

const timeUnitMap = {
  'year': 'Y',
  'years': 'Y',
  'month': 'M',
  'months': 'M',
  'week': 'w',
  'weeks': 'w',
  'weekday': 'W',
  'day': 'd',
  'days': 'd',
  'hour': 'h',
  'hours': 'h',
  'minute': 'm',
  'minutes': 'm',
  'min': 'm',
  'mins': 'm',
};

export const relativeValueRe = /^(.+)?(\+|-)(\d+)(minute|minutes|min|mins|hours|hour|day|days|week|weeks|month|months|year|years|weekday)$/i;
export const filterDate = (value, data, format = "X") => {
  let m;

  if (typeof value === "string") {
    value = value.trim();
  }

  value = filter(value, data);

  if (value && typeof value === "string" && (m = relativeValueRe.exec(value))) {
    const date = new Date();
    const step = parseInt(m[3], 10);
    const from = m[1]
      ? filterDate(m[1], data, format)
      : moment(/minute|minutes|min|mins|hours|hour/.test(m[4])
        ? [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
        : [date.getFullYear(), date.getMonth(), date.getDate()]);

    return m[2] === "-"
      ? from.subtract(step, timeUnitMap[(m[4])])
      : from.add(step, timeUnitMap[(m[4])]);
    //   return from[m[2] === '-' ? 'subtract' : 'add'](step, mapping[m[4]] || m[4]);
  } else if (value === "now") {
    return moment();
  } else if (value === "today") {
    const date = new Date();
    return moment([date.getFullYear(), date.getMonth(), date.getDate()]);
  } else {
    return moment(value, format);
  }
};

// 过滤器列表
export const filters = {
  html: (input) => escapeHtml(input),
  json: (input, tabSize = 2) =>
    tabSize
      ? JSON.stringify(input, null, parseInt(tabSize, 10))
      : JSON.stringify(input),
  toJson: input => {
    let ret = input;
    if (typeof input == "string") {
      try {
        ret = JSON.parse(input);
      } catch (e) {
        ret = null;
      }
    }
    return ret;
  },
  raw: input => input,
  toDate: input =>{
    let v=  (!isNaN(+input) && +input > 0 && new Date(+input)) || (input != null && moment(input)).toDate() || null;
    return v;
  },
  date: (input, format = "LLL", inputFormat = "X") => {
    return  moment(input, inputFormat).format(format)
  },
  plusDate: (input, format = "LLL", inputFormat = "X") => {
    let plusDate = input
    if (/(-?\d+)(\w+)/.test(format + "")) {
      let formateCompares = ["ms", "y", "Q", "M", "w", "d", "h", "m", "s"];
      let num = +RegExp.$1,
          numType = RegExp.$2;
      if (!isNaN(num) && numType && ~formateCompares.indexOf(numType)) {
        plusDate = moment(input, inputFormat).add(num, numType)
      }
    }
    return plusDate.toDate()
  },
  number: input => String(input).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  trim: input => input.trim(),
  percent: (input, decimals = 0) => {
    input = parseFloat(input) || 0;
    decimals = parseInt(decimals, 10) || 0;

    let whole = input * 100;
    let multiplier = Math.pow(10, decimals);

    return (
      (Math.round(whole * multiplier) / multiplier).toFixed(decimals) + "%"
    );
  },
  duration: input => (input ? formatDuration(input) : input),
  bytes: input => (input ? prettyBytes(parseFloat(input)) : input),
  round: (input, decimals = 0) => {
    if (isNaN(input)) {
      return 0;
    }

    decimals = parseInt(decimals, 10) || 2;

    let multiplier = Math.pow(10, decimals);
    return (Math.round(input * multiplier) / multiplier).toFixed(decimals);
  },
  truncate: (input, length, end) => {
    end = end || "...";

    if (input == null || length == null) {
      return input;
    }

    length = parseInt(length, 10) || 200;

    return input.substring(0, length) + (input.length > length ? end : "");
  },
  url_encode: input => encodeURIComponent(input),
  url_decode: input => decodeURIComponent(input),
  default: (input, defaultValue) => input || (() => {
    try {
      if (defaultValue === 'undefined') {
        return undefined;
      }
      return JSON.parse(defaultValue);// maybe json
    } catch (e) {
      return defaultValue;
    }
  })(),
  join: (input, glue) => (input && input.join ? input.join(glue) : input),
  split: (input, delimiter = ",") =>
    typeof input === "string" ? input.split(delimiter) : input,
  first: input => input && input[0],
  nth: (input, nth = 0) => input && input[nth],
  last: input => input && (input.length ? input[input.length - 1] : null),
  minus: (input, step = 1) => (parseInt(input, 10) || 0) - parseInt(step, 10),
  plus: (input, step = 1) => (parseInt(input, 10) || 0) + parseInt(step, 10),
  pick: (input, path = "&") =>{
    if (input == null || input == undefined) {
      return input;
    }
    return Array.isArray(input) && !/^\d+$/.test(path)
        ? input.map(item => pickValues(path, item))
        : pickValues(path, input)
  },
  pick_if_exist: (input, path = "&") =>
    Array.isArray(input)
      ? input.map(item => resolveVariable(path, item) || item)
      : (input!=null && resolveVariable(path, input)) || input,
  str2date: function (input, inputFormat = "X", outputFormat = "X") {
    return input
      ? filterDate(input, this, inputFormat).format(outputFormat)
      : "";
  },
  asArray: input => (input ? [input] : input),
  filter: function (input, keys, exp) {
    let keywords;
    if (!Array.isArray(input) || !keys || !exp || !(keywords = resolveVariable(exp, this))) {
      return input;
    }

    keywords = keywords.toLowerCase();
    keys = keys.split(/\s*,\s*/);
    return input.filter((item) => keys.some((key) => ~String(resolveVariable(key, item)).toLowerCase().indexOf(keywords)));
  },
  base64Encode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) {
        return String.fromCharCode(('0x' + p1));
      }));
  },

  base64Decode(str) {
    return decodeURIComponent(atob(str).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  },

  lowerCase: input => input && typeof input === 'string' ? input.toLowerCase() : input,
  upperCase: input => input && typeof input === 'string' ? input.toUpperCase() : input,
  base64File(str, fileName) {
    let aLink = document.createElement('a');
    let blob = base64ToBlob(str); //new Blob([content]);
    aLink.download = fileName;
    aLink.href = URL.createObjectURL(blob);
    aLink.click()
  }
};

//base64转blob
function base64ToBlob(code) {
  let parts = code.split(';base64,');
  let contentType = parts[0].split(':')[1];
  let raw = window.atob(parts[1]);
  let rawLength = raw.length;
  let uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// 注册过滤器
export function registerFilter(name, fn) {
  filters[name] = fn;
}

export function pickValues(names, data) {
  let arr;
  if (!names || (arr = names.split(',')) && arr.length < 2) {
    let idx = names.indexOf('~');
    if (~idx) {
      let key = names.substring(0, idx);
      let target = names.substring(idx + 1);
      return {
        [key]: resolveVariable(target, data)
      }
    }
    return resolveVariable(names, data);
  }

  let ret = {};
  arr.forEach(name => {
    let idx = name.indexOf('~');
    let target = name;

    if (~idx) {
      target = name.substring(idx + 1);
      name = name.substring(0, idx);
    }

    setVariable(ret, name, resolveVariable(target, data));
  });
  return ret;
}

export const resolveVariable = (path, data) => {
  if (!path) {
    return undefined;
  }

  if (path === "$$") {
    return data;
  } else if (path[0] === "$") {
    path = path.substring(1);
  } else if (path === "&") {
    return data;
  }

  if (typeof data[path] !== "undefined") {
    return data[path];
  }

  let parts = path.replace(/^{|}$/g, "").split(".");
  return parts.reduce((data, path) => {
    if ((isObject(data) || Array.isArray(data)) && path in data) {
      return data[path];
    }

    return undefined;
  }, data);
};

/**
 * 变量模版取数
 * @param path 如 ${name}
 * @param data 数据 ，如{name:111}
 * @param defaultFilter 过滤器 如${name|toJson}
 * @returns {string|undefined}
 */
export const resolveVariableAndFilter = (path, data, defaultFilter='| raw') => {
  if (!path) {
    return undefined;
  }

  const m = /^(\\)?\$(?:([a-z0-9_.]+)|{([\s\S]+)})$/i.exec(path);

  if (!m) {
    return undefined;
  }

  const [_, escape, key, key2] = m;

  // 如果是转义如： `\$abc` => `$abc`
  if (escape) {
    return _.substring(1);
  }

  let finalKey = key || key2;

  // 先只支持一层吧 , 后期支持分组等情况
  finalKey = finalKey.replace(/(\\)?\$(?:([a-z0-9_.]+)|{([^}{]+)})/g, (_, escape) => {
    return escape ? _.substring(1) : resolveVariableAndFilter(_, data, defaultFilter);
  });

  // 默认 html 转义
  if (!~finalKey.indexOf("|")) {
    finalKey += defaultFilter;
  }

  let paths = finalKey.split(/\s*\|\s*/g);
  let originalKey = finalKey;
  finalKey = paths.shift();

  let ret = resolveVariable(finalKey, data);

  return ret == null && !~originalKey.indexOf("default")
    ? ""
    : paths.reduce((input, filter) => {
      let params = filter
        .replace(/([^\\])\\([\:\\])/g, (_, affix, content) => `${affix}__${content === ':' ? 'colon' : 'slash'}__`)
        .split(":")
        .map(item => item.replace(/__(slash|colon)__/g, (_, type) => type === 'colon' ? ':' : '\\'));
      let key = params.shift();

      return (filters[key] || filters.raw).call(data, input, ...params);
    }, ret);
};

// 字符串模版取数，如"我是${studentName|raw}的老师${teacherName}."
export const tokenize = (str, data, defaultFilter) => {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return str.replace(/(\\)?\$(?:([a-z0-9_\.]+|&)|{([^}{]+?)})/gi, (_, escape) =>
    escape ? _.substring(1) : resolveVariableAndFilter(_, data, defaultFilter)
  );
};

function resolveMapping(value, data) {
  return typeof value === "string" &&
  /^\$(?:([a-z0-9_.]+)|{[^}{]+})$/.test(value)
    ? resolveVariableAndFilter(value, data, '| raw')
    : typeof value === "string" && ~value.indexOf("$")
      ? tokenize(value, data, '| raw')
      : value;
}

/**
 * 数据对象映射
 * @param to 映射模版
 * @param from 数据源
 */
export function dataMapping(to, from) {
  let ret = {};

  Object.keys(to).forEach(key => {
    const value = to[key];
    let keys;

    if (key === "&" && value === "$$") {
      ret = {
        ...ret,
        ...from
      };
    } else if (key === "&") {
      const v = resolveMapping(value, from);

      if (Array.isArray(v) || typeof v === "string") {
        ret = v;
      } else if (typeof v === 'function') {
        ret = {
          ...ret,
          ...v(from)
        };
      } else {
        // @note 支持返回原始值，而非只是对象类型
        if (Array.isArray(v) || isObject(v)) {
          ret = {
            ...ret,
            ...v
          };
        } else {
          ret = v;
        }
      }
    } else if (value === "$$") {
      ret[key] = from;
    } else if (value && value[0] === "$") {
      const v = resolveMapping(value, from);
      ret[key] = v;

      if (v === "__undefined") {
        delete ret[key];
      }
    } else if (
      isPlainObject(value) &&
      (keys = Object.keys(value)) &&
      keys.length === 1 &&
      from[keys[0].substring(1)] &&
      Array.isArray(from[keys[0].substring(1)])
    ) {
      // 支持只取数组中的部分值这个需求
      // 如:
      // data: {
      //   items: {
      //     '$rows': {
      //        id: '$id',
      //        forum_id: '$forum_id'
      //      }
      //   }
      // }
      const arr = from[keys[0].substring(1)];
      const mapping = value[keys[0]];

      ret[key] = arr.map((raw) => dataMapping(mapping, createObject(from, raw)));

    } else if (isPlainObject(value)) {
      ret[key] = dataMapping(value, from);
    } else if (Array.isArray(value)) {
      ret[key] = value.map((value) => isPlainObject(value) ? dataMapping(value, from) : resolveMapping(value, from));
    } else if (typeof value == "string" && ~value.indexOf("$")) {
      ret[key] = resolveMapping(value, from);
    } else if (typeof value === 'function') {
      ret[key] = value(from);
    } else {
      ret[key] = value;
      if (value === "__undefined") {
        delete ret[key];
      }
    }
  });

  return ret;
}

reigsterTplEnginer("builtin", {
  test: str => !!~str.indexOf("$"),
  compile: (str, data) => tokenize(str, data)
});

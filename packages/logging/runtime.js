const {Logger} = require("./Logger");
const createConsoleLogger = require("./createConsoleLogger");

/** @type {createConsoleLogger.LoggerOptions} */
let currentDefaultLoggerOptions = {
  level: "info",
  debug: false,
  console
};
let currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);

/**
 * @param {string} name name of the logger
 * @returns {Logger} a logger
 */
exports.getLogger = name => {
  return new Logger((type, args) => {
    currentDefaultLogger(name, type, args);
  });
};

/**
 * @param {createConsoleLogger.LoggerOptions} options new options, merge with old options
 * @returns {void}
 */
exports.configureDefaultLogger = options => {
  Object.assign(currentDefaultLoggerOptions, options);
  currentDefaultLogger = createConsoleLogger(currentDefaultLoggerOptions);
};

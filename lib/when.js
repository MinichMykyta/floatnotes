/**
 * A lightweight CommonJS Promises/A and when() implementation
 * when is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @version 1.7.1
 */

// Added by Felix Kling:
// Some boilerplate code to make it work in a FirefoxPlugin
var EXPORTED_SYMBOLS = ['FloatNotesWhen'];

class Promise {
  constructor(then) {
    this.then = then;
  }

  always(onFulfilledOrRejected, onProgress) {
    return this.then(onFulfilledOrRejected, onFulfilledOrRejected, onProgress);
  }

  otherwise(onRejected) {
    return this.then(undefined, onRejected);
  }

  yield(value) {
    return this.then(() => value);
  }

  spread(onFulfilled) {
    return this.then(array => all(array, array => onFulfilled(...array)));
  }
}

function fulfilled(value) {
  return new Promise(onFulfilled => resolve(onFulfilled ? onFulfilled(value) : value));
}

function rejected(reason) {
  return new Promise((_, onRejected) => onRejected ? resolve(onRejected(reason)) : rejected(reason));
}

class Deferred {
  constructor() {
    this.handlers = [];
    this.progressHandlers = [];
    this.promise = new Promise((resolve, reject) => {
      this.resolve = val => resolve(resolve(val));
      this.reject = err => resolve(rejected(err));
      this.progress = update => resolve(update);
    });
  }

  then(onFulfilled, onRejected, onProgress) {
    const deferred = new Deferred();

    const progressHandler = typeof onProgress === 'function'
      ? update => deferred.progress(onProgress(update))
      : update => deferred.progress(update);

    this.handlers.push(promise => {
      promise.then(onFulfilled, onRejected)
        .then(deferred.resolve, deferred.reject, progressHandler);
    });

    this.progressHandlers.push(progressHandler);

    return deferred.promise;
  }
}

function resolve(promiseOrValue) {
  if (promiseOrValue instanceof Promise) {
    return promiseOrValue;
  } else if (isPromise(promiseOrValue)) {
    const deferred = new Deferred();

    promiseOrValue.then(
      value => deferred.resolve(value),
      reason => deferred.reject(reason),
      update => deferred.progress(update)
    );

    return deferred.promise;
  } else {
    return fulfilled(promiseOrValue);
  }
}

function reject(promiseOrValue) {
  return when(promiseOrValue, rejected);
}

function isPromise(promiseOrValue) {
  return promiseOrValue && typeof promiseOrValue.then === 'function';
}

function checkCallbacks(start, arrayOfCallbacks) {
  arrayOfCallbacks.forEach((arg, i) => {
    if (i >= start && !(arg == null || typeof arg === 'function')) {
      throw new Error(`arg ${i} must be a function`);
    }
  });
}

function some(promisesOrValues, howMany, onFulfilled, onRejected, onProgress) {
  checkCallbacks(2, arguments);

  return when(promisesOrValues, promisesOrValues => {
    let toResolve = Math.max(0, Math.min(howMany, promisesOrValues.length));
    let values = [];
    let toReject = promisesOrValues.length - toResolve + 1;
    let reasons = [];
    const deferred = new Deferred();

    if (toResolve === 0) {
      deferred.resolve(values);
    } else {
      const progress = deferred.progress;

      const rejectOne = reason => {
        reasons.push(reason);
        if (--toReject === 0) {
          deferred.reject(reasons);
        }
      };

      const fulfillOne = val => {
        values.push(val);
        if (--toResolve === 0) {
          deferred.resolve(values);
        }
      };

      promisesOrValues.forEach(promise => {
        when(promise, fulfiller, rejecter, progress);
      });
    }

    return deferred.then(onFulfilled, onRejected, onProgress);

    function rejecter(reason) {
      rejectOne(reason);
    }

    function fulfiller(val) {
      fulfillOne(val);
    }
  });
}

function any(promisesOrValues, onFulfilled, onRejected, onProgress) {
  function unwrapSingleResult(val) {
    return onFulfilled ? onFulfilled(val[0]) : val[0];
  }

  return some(promisesOrValues, 1, unwrapSingleResult, onRejected, onProgress);
}

function all(promisesOrValues, onFulfilled, onRejected, onProgress) {
  checkCallbacks(1, arguments);
  return map(promisesOrValues, identity).then(onFulfilled, onRejected, onProgress);
}

function join() {
  return map(arguments, identity);
}

function map(promise, mapFunc) {
  return when(promise, array => {
    let results = [];
    let toResolve = array.length;
    const deferred = new Deferred();

    if (toResolve === 0) {
      deferred.resolve(results);
    } else {
      const resolve = (item, i) => {
        when(item, mapFunc).then(mapped => {
          results[i] = mapped;
          if (--toResolve === 0) {
            deferred.resolve(results);
          }
        }, deferred.reject);
      };

      array.forEach((item, i) => {
        resolve(item, i);
      });
    }

    return deferred.promise;
  });
}

function reduce(promise, reduceFunc) {
  const args = Array.from(arguments).slice(1);

  return when(promise, array => {
    const total = array.length;
    args[0] = (current, val, i) => {
      return when(current, c => when(val, value => reduceFunc(c, value, i, total)));
    };
    return reduceArray.apply(array, args);
  });
}

function chain(promiseOrValue, resolver, resolveValue) {
  const useResolveValue = arguments.length > 2;

  return when(promiseOrValue, val => {
    val = useResolveValue ? resolveValue : val;
    resolver.resolve(val);
    return val;
  }, reason => {
    resolver.reject(reason);
    return rejected(reason);
  }, resolver.progress);
}

const slice = Array.prototype.slice;
const reduceArray = Array.prototype.reduce || function (reduceFunc) {
  let arr = Object(this);
  let len = arr.length >>> 0;
  let i = 0;
  let reduced;

  if (arguments.length <= 1) {
    for (;;) {
      if (i in arr) {
        reduced = arr[i++];
        break;
      }
      if (++i >= len) {
        throw new TypeError();
      }
    }
  } else {
    reduced = arguments[1];
  }

  for (; i < len; ++i) {
    if (i in arr) {
      reduced = reduceFunc(reduced, arr[i], i, arr);
    }
  }

  return reduced;
};

function identity(x) {
  return x;
}

function when(promiseOrValue, onFulfilled, onRejected, onProgress) {
  return resolve(promiseOrValue).then(onFulfilled, onRejected, onProgress);
}

// Boilerplate for AMD, Node, and the browser
(function (definition) {
  // Export as AMD module if possible
  if (typeof define === 'function' && define.amd) {
    define(definition);
  }
  // Export as Node module if possible
  else if (typeof module === 'object' && module.exports) {
    module.exports = definition();
  }
  // Otherwise attach to the global object
  else {
    FloatNotesWhen = definition();
  }
})(function () {
  return {
    Promise,
    Deferred,
    fulfilled,
    rejected,
    resolve,
    reject,
    isPromise,
    when,
    some,
    any,
    all,
    join,
    map,
    reduce,
    chain
  };
});

function nop() {}

var assign  = require('object-assign'),
    events  = require('events');

module.exports = function (options, middleware) {
    if (typeof options === 'function') {
        middleware = options;
        options = {};
    }

    options = options || {};
    options.retryInterval = options.retryInterval || 5000;

    if (typeof middleware !== 'function') {
        throw new Error('middleware should be a function, not an ' + typeof middleware);
    }

    var cache = new events.EventEmitter();
    cache.setMaxListeners(0);

    var updating = false;
    function updateCache() {
        if (updating) { return; }

        var req = {};
        updating = true;

        middleware(req, undefined, function (err) {
            if (!options.breakOnError && err && cache.result === undefined && options.retryInterval) {
                setTimeout(updateCache, options.retryInterval);
                return;
            }

            if (options.updateInterval > 0) {
                setTimeout(updateCache, options.updateInterval);
            }

            updating = false;
            if (err && options.breakOnError) { return cache.emit('updateError', err); }

            cache.result = req;
            cache.emit('ready', req);
        });
    }

    if (options.hotStart) { updateCache(); }

    return function memorize(req, res, next) {
        next = next || nop;

        if (options.breakOnError) {
            cache.once('updateError', next);
        }

        if (cache.result) {
            assign(req, cache.result);
            return next();
        }

        cache.once('ready', function (data) {
            assign(req, data);
            return next();
        });

        if (!options.hotStart) {
            updateCache();
        }
    };
};

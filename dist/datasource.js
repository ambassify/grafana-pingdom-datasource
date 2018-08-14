'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var APP_KEY = 'kr1678azp3l9pceh0hysjnvsdmnp0exb';
var PINGDOM_MAX_LIMIT = 1000;
var PINGDOM_MAX_OFFSET = 43200;

var HOUR_MS = 3600 * 1000;
var DAY_MS = HOUR_MS * 24;
var WEEK_MS = DAY_MS * 7;
var MONTH_MS = DAY_MS * 30;

var metrics = [{
    text: 'Status',
    value: 'status'
}, {
    text: 'Response Time',
    value: 'time'
}];

var Pingdom = exports.Pingdom = function () {
    function Pingdom(instanceSettings, $q, backendSrv, templateSrv) {
        _classCallCheck(this, Pingdom);

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;

        this.headers = {
            'App-Key': APP_KEY
        };
    }

    _createClass(Pingdom, [{
        key: 'query',
        value: function query(options) {
            var _this = this;

            var targets = options.targets,
                range = options.range;


            return Promise.all(targets.map(function (target) {
                var alias = target.alias,
                    check = target.check,
                    checkName = target.checkName,
                    metric = target.metric,
                    refId = target.refId;


                return _this.getCheckResults(target, options).then(function (results) {
                    return {
                        target: alias || checkName || check,
                        refId: refId,
                        datapoints: results.map(function (r) {
                            return [_this.getMetric(r, metric), (r.time || r.starttime) * 1000];
                        })
                    };
                });
            })).then(function (data) {
                return { data: data };
            });
        }
    }, {
        key: 'testDatasource',
        value: function testDatasource() {
            return this.doRequest({
                url: "/settings"
            }).then(function (resp) {
                if (resp.status < 200 || resp.status >= 400) throw new Error(resp.status + ' ' + resp.statusMessage);

                return {
                    status: 'success',
                    message: 'Connected to ' + (resp.data.settings.description || resp.data.settings.company),
                    title: 'Success'
                };
            }).catch(function (err) {
                return { status: 'failure', message: 'Connection failed', title: 'Error' };
            });
        }
    }, {
        key: 'annotationQuery',
        value: function annotationQuery(options) {
            var _this2 = this;

            var annotation = options.annotation,
                range = options.range;
            var checks = annotation.checks,
                status = annotation.status;


            var from = range.from.unix();
            var to = range.to.unix();

            return Promise.all(checks.map(function (check) {
                return _this2.doRequest({
                    url: '/summary.outage/' + check.id + '?from=' + from + '&to=' + to
                }).then(function (res) {
                    return res.data.summary.states;
                }).catch(_this2.handleError);
            })).then(function (responses) {
                return responses.map(function (results, idx) {
                    var check = checks[idx];

                    return results.filter(function (r) {
                        return !status || r.status == status;
                    }).map(function (r) {
                        return {
                            annotation: annotation,
                            title: check.name + ' ' + r.status.toUpperCase(),
                            time: r.timefrom * 1000,
                            text: check.name + ' (' + check.hostname + ') changed state to ' + r.status.toUpperCase(),
                            tags: [check.name, check.type, r.status]
                        };
                    });
                });
            }).then(function (results) {
                return results.reduce(function (out, r) {
                    return out.concat(r);
                });
            });
        }
    }, {
        key: 'metricFindQuery',
        value: function metricFindQuery(search) {
            search = search.toLowerCase();

            if (search.length < 1) return Promise.resolve(metrics.slice());

            var found = metrics.filter(function (v) {
                var text = v.text.toLowerCase();
                var value = v.value.toLowerCase();

                return text.indexOf(search) > -1 || value.indexOf(search) > -1;
            });

            return Promise.resolve(found);
        }
    }, {
        key: 'checkFindQuery',
        value: function checkFindQuery(search) {
            if (!this._checks) {
                this._checks = this.doRequest({ url: '/checks' }).then(function (resp) {
                    return resp.data.checks;
                }).catch(this.handleError);
            }

            if (!search) return this._checks;

            return this._checks.then(function (checks) {
                return checks.filter(function (c) {
                    return c.name.indexOf(search) > -1;
                });
            });
        }
    }, {
        key: 'getMetric',
        value: function getMetric(row, metricName) {
            if (metricName == 'time') return row.responsetime || row.avgresponse;

            if (metricName == 'status') {
                if (row.status) return row.status == 'up' ? 100 : 0;

                var downtime = row.downtime,
                    unmonitored = row.unmonitored,
                    uptime = row.uptime;

                var total = downtime + unmonitored + uptime;

                if (total < 1) return 0;

                return uptime / total * 100;
            }

            return 0;
        }
    }, {
        key: 'getCheckResults',
        value: function getCheckResults(target, query) {
            var _this3 = this;

            var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
            var check = target.check;
            var range = query.range,
                intervalMs = query.intervalMs;

            var from = range.from.unix();
            var to = range.to.unix();
            var period = (to - from) * 1000;

            if (!check) return Promise.resolve([]);

            var endpoint = 'summary.performance';
            var resolution = 'hour';

            // Only sub-hour results for ranges smaller than 3 days
            if (intervalMs < HOUR_MS && period < 3 * DAY_MS) {
                endpoint = 'results';
                resolution = null;
            }

            if (intervalMs < DAY_MS && period > WEEK_MS) resolution = 'day';

            if (intervalMs >= DAY_MS) resolution = 'day';

            if (intervalMs < WEEK_MS && period > 6 * MONTH_MS) resolution = 'week';

            if (intervalMs >= WEEK_MS) resolution = 'week';

            var url = '/' + endpoint + '/' + check + '?from=' + from + '&to=' + to;

            if (resolution) url += '&resolution=' + resolution + '&includeuptime=true';else url += '&limit=' + PINGDOM_MAX_LIMIT + '&offset=' + offset;

            return this.doRequest({ url: url }).then(function (res) {
                if (res.status !== 200) throw new Error(res.data.error.errormessage || res.statusText);

                var summary = res.data.summary;


                var results = res.data.results || summary.hours || summary.days || summary.weeks;

                // Summary endpoint does not allow paging
                if (resolution) return results;

                if (results.length < PINGDOM_MAX_LIMIT || offset + PINGDOM_MAX_LIMIT > PINGDOM_MAX_OFFSET) return results;

                return _this3.getCheckResults(target, query, offset + PINGDOM_MAX_LIMIT).then(function (res) {
                    return results.concat(res);
                });
            }).catch(this.handleError);
        }
    }, {
        key: 'handleError',
        value: function handleError(res) {
            if (!res.data && !res.statusText) throw err;

            if (!res.data.error) throw new Error(res.statusText);

            throw new Error(res.data.error.errormessage || res.statusText);
        }
    }, {
        key: 'doRequest',
        value: function doRequest(options) {
            options.headers = Object.assign({}, this.headers, options.headers);
            options.method = options.method || 'GET';
            options.url = this.url + '/pingdom' + options.url;

            return this.backendSrv.datasourceRequest(options);
        }
    }]);

    return Pingdom;
}();
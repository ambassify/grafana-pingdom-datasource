import _ from 'lodash';

const APP_KEY = 'kr1678azp3l9pceh0hysjnvsdmnp0exb';
const PINGDOM_MAX_LIMIT = 1000;
const PINGDOM_MAX_OFFSET = 43200;

const HOUR_MS = 3600 * 1000;
const DAY_MS = HOUR_MS * 24;
const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;

const metrics = [{
    text: 'Status',
    value: 'status'
}, {
    text: 'Response Time',
    value: 'time'
}];

const durations = [{
    name: 'seconds',
    count: 60
}, {
    name: 'minutes',
    count: 60
}, {
    name: 'hours',
    count: 24
}, {
    name: 'days'
}];

function formatDuration(time) {
    let idx = 0;
    let cur = durations[idx];

    while (cur.count && time > cur.count) {
        time = time / cur.count;
        cur = durations[++idx];
    }

    return Math.floor(time) + ' ' + cur.name;
}

export
class Pingdom {

    constructor(instanceSettings, $q, backendSrv, templateSrv) {
        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.requestCache = {};

        this.headers = {
            'App-Key': APP_KEY
        };
    }

    query(options){
        const { targets } = options;

        return Promise.all(targets.map(target => {
            const { alias, check, checkName, metric, refId } = target;

            return this.getCheckResults(target, options)
                .then(results => ({
                    target: alias || checkName || check,
                    refId,
                    datapoints: results.map(r => ([
                        this.getMetric(r, metric),
                        (r.time || r.starttime) * 1000
                    ]))
                }));
        }))
            .then(data => ({ data }));
    }

    testDatasource() {
        return this.doRequest({
            url: '/settings'
        })
            .then(resp => {
                if (resp.status < 200 || resp.status >= 400)
                    throw new Error(`${resp.status} ${resp.statusMessage}`);

                return {
                    status: 'success',
                    message: `Connected to ${resp.data.settings.description || resp.data.settings.company}`,
                    title: 'Success'
                };
            })
            .catch(() => {
                return { status: 'failure', message: 'Connection failed', title: 'Error' };
            });
    }

    annotationQuery(options){
        const { annotation, range } = options;
        const { checks, state } = annotation;

        const from = range.from.unix();
        const to = range.to.unix();

        return Promise.all(checks.map(check => {
            return this.doRequest({
                url: `/summary.outage/${check.id}?from=${from}&to=${to}`
            })
                .then(res => res.data.summary.states)
                .catch(this.handleError);
        }))
            .then(responses => responses.map((results, idx) => {
                const check = checks[idx];

                return results
                    .filter(r => !state || r.status == state)
                    .map(r => ({
                        annotation,
                        title: `${check.name} (${check.hostname})`,
                        time: r.timefrom * 1000,
                        text: `\nState: ${r.status.toUpperCase()}\nDuration: ${formatDuration(r.timeto - r.timefrom)}`,
                        tags: [check.name, check.type, r.status]
                    }));
            }))
            .then(results => results.reduce((out, r) => out.concat(r)));
    }

    metricFindQuery(search){
        if (search == 'checks()') {
            return this.checkFindQuery()
                .then(checks => checks.map(c => ({
                    text: c.name,
                    value: c.name + ' - ' + c.id
                })));
        }

        search = search.toLowerCase();

        if (search.length < 1)
            return Promise.resolve(metrics.slice());

        const found = metrics.filter(v => {
            const text = v.text.toLowerCase();
            const value = v.value.toLowerCase();

            return text.indexOf(search) > -1 || value.indexOf(search) > -1;
        });

        return Promise.resolve(found);
    }

    checkFindQuery(search){
        if (!this._checks) {
            this._checks = this.doRequest({ url: '/checks' })
                .then(resp => resp.data.checks)
                .catch(this.handleError);
        }

        if (!search)
            return this._checks;

        return this._checks
            .then(checks => checks.filter(c => c.name.indexOf(search) > -1));
    }

    getMetric(row, metricName) {
        if (metricName == 'time')
            return row.responsetime || row.avgresponse;

        if (metricName == 'status') {
            if (row.status)
                return row.status == 'up' ? 100 : 0;

            const { downtime, unmonitored, uptime } = row;
            const total = downtime + unmonitored + uptime;

            if (total < 1)
                return 0;

            return (uptime / total) * 100;
        }

        return 0;
    }

    getCheckResults(target, query, offset = 0) {
        let { check } = target;
        const { range, intervalMs, scopedVars } = query;
        const from = range.from.unix();
        const to = range.to.unix();
        const period = (to - from) * 1000;

        if (/^\$/.test(check || '')) {
            check = this.templateSrv.replace(check, scopedVars);
            check = (/\d+$/.exec(check) || [])[0];
        }

        if (!check)
            return Promise.resolve([]);

        let endpoint = 'summary.performance';
        let resolution = 'hour';

        // Only sub-hour results for ranges smaller than 3 days
        if (intervalMs < HOUR_MS && period < 3 * DAY_MS) {
            endpoint = 'results';
            resolution = null;
        }

        if (intervalMs < DAY_MS && period > WEEK_MS)
            resolution = 'day';

        if (intervalMs >= DAY_MS)
            resolution = 'day';

        if (intervalMs < WEEK_MS && period > 6 * MONTH_MS)
            resolution = 'week';

        if (intervalMs >= WEEK_MS)
            resolution = 'week';

        let url = `/${endpoint}/${check}?from=${from}&to=${to}`;

        if (resolution)
            url += `&resolution=${resolution}&includeuptime=true`;
        else
            url += `&limit=${PINGDOM_MAX_LIMIT}&offset=${offset}`;


        return this.doRequest({ url })
            .then(res => {
                if (res.status !== 200)
                    throw new Error(res.data.error.errormessage || res.statusText);

                const { summary } = res.data;

                const results = res.data.results ||
                summary.hours ||
                summary.days ||
                summary.weeks;

                // Summary endpoint does not allow paging
                if (resolution)
                    return results;

                if (results.length < PINGDOM_MAX_LIMIT || offset + PINGDOM_MAX_LIMIT > PINGDOM_MAX_OFFSET)
                    return results;

                return this.getCheckResults(target, query, offset + PINGDOM_MAX_LIMIT)
                    .then(res => results.concat(res));
            })
            .catch(this.handleError);
    }

    handleError(res) {
        if (!res.data && !res.statusText)
            throw res;

        if (!res.data.error)
            throw new Error(res.statusText);

        throw new Error(res.data.error.errormessage || res.statusText);
    }

    doRequest(options) {
        const cacheKey = options.url.replace(/((from|to)=\d+)\d\d(&?)/gi, '$1$3');

        if (this.requestCache[cacheKey])
            return this.requestCache[cacheKey];

        options.headers = Object.assign({}, this.headers, options.headers);
        options.method = options.method || 'GET';
        options.url = this.url + '/pingdom' + options.url;

        const promise = this.backendSrv.datasourceRequest(options);
        this.requestCache[cacheKey] = promise;

        setTimeout(() => {
            delete this.requestCache[cacheKey];
        }, 60000);

        return promise;
    }
}

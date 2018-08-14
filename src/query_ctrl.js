import {QueryCtrl} from 'app/plugins/sdk';

export class PingdomQueryCtrl extends QueryCtrl {

    constructor($scope, $injector, uiSegmentSrv)  {
        super($scope, $injector);

        this.scope = $scope;
        this.uiSegmentSrv = uiSegmentSrv;

        this.target.check = this.target.check || '';
        this.target.metric = this.target.metric || 'time';

        this.initSegments();

        Promise.all([
            this.getMetricSegments(),
            this.getCheckSegments()
        ]).catch(() => {});
    }

    initSegments() {
        this.segments = {
            metric: this.uiSegmentSrv.newSegment({ html: '-- select metric --' }),
            check: this.uiSegmentSrv.newSegment({ html: '-- select check --' }),
        };
    }

    onSegmentChange() {
        const value = this.segments.check.value || '';
        const check = /(\$.*)|([0-9]+$)/gi.exec(value + '') || [];

        const checkId = check[1] || parseInt(check[2], 10);
        const checkName = value.replace(/:\s*\d+$/gi, '');
        const metric = this.segments.metric.value;

        if (this.target.check == checkId && this.target.metric == metric)
            return;

        if (!check || !metric)
            return;

        Object.assign(this.target, {
            check: checkId,
            checkName,
            metric
        });

        this.refresh();
    }

    getScopedVars() {
        const vars = this.datasource.templateSrv.variables;

        return vars.map(v => '$' + v.name)
            .filter(v => !!v);
    }

    getMetricSegments(query = '') {
        return this.datasource.metricFindQuery(query)
            .then(metrics => metrics.map(m => ({
                html: m.text,
                value: m.value
            })))
            .then(metrics => metrics.map(metric => {
                const segment = this.uiSegmentSrv.newSegment(metric);

                if (!this.segments.metric.value && metric.value == this.target.metric)
                    this.updateSegment('metric', segment);

                return segment;
            }));
    }

    getCheckSegments(query = '') {
        const vars = this.getScopedVars().map(k => ({
            id: k,
            value: k
        }));

        return this.datasource.checkFindQuery(query)
            .then(checks => checks.map(c => ({
                html: c.name,
                id: c.id,
                value: c.name + ': ' + c.id
            })))
            .then(checks => vars.concat(checks))
            .then(checks => checks.map(check => {
                const segment = this.uiSegmentSrv.newSegment(check);

                if (!this.segments.check.value && check.id == this.target.check)
                    this.updateSegment('check', segment);

                return segment;
            }));
    }

    updateSegment(name, segment) {
        const s = this.segments[name];

        if (s.value == segment.value)
            return;

        s.value = segment.value;
        s.html = segment.html;

        this.onSegmentChange();
    }
}

PingdomQueryCtrl.templateUrl = 'partials/query.editor.html';


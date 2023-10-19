define('dashboard-custom-location:views/dashboard', ['view', 'lib!gridstack'], function (Dep, Gridstack) {

    return Dep.extend({

        template: 'dashboard',

        dashboardLayout: null,

        currentTab: null,

        WIDTH_MULTIPLIER: 3,

        scope: null,

        events: {
            'click button[data-action="selectTab"]': function (e) {
                let tab = parseInt($(e.currentTarget).data('tab'));

                this.selectTab(tab);
            },
            'click .dashboard-buttons [data-action="addDashlet"]': function () {
                this.createView('addDashlet', 'views/modals/add-dashlet', {}, view => {
                    view.render();

                    this.listenToOnce(view, 'add', name => {
                        this.addDashlet(name);
                    });
                });
            },
            'click .dashboard-buttons [data-action="editTabs"]': function () {
                this.editTabs();
            },
        },

        data: function () {
            return {
                displayTitle: this.options.displayTitle,
                currentTab: this.currentTab,
                tabCount: this.dashboardLayout.length,
                dashboardLayout: this.dashboardLayout,
                layoutReadOnly: this.layoutReadOnly,
                hasAdd: !this.layoutReadOnly && !this.getPreferences().get('dashboardLocked'),
            };
        },

        generateId: function () {
            return (Math.floor(Math.random() * 10000001)).toString();
        },

        setupCurrentTabLayout: function () {
            if (!this.dashboardLayout) {
                let defaultLayout = [{
                    "name": "My Espo",
                    "layout": [],
                }];

                if (this.getConfig().get('forcedDashboardLayout')) {
                    this.dashboardLayout = this.getConfig().get('forcedDashboardLayout') || [];
                } else if (this.getUser().get('portalId')) {
                    this.dashboardLayout = this.getConfig().get('dashboardLayout') || [];
                } else {
                    this.dashboardLayout = this.getPreferences().get('dashboardLayout') || defaultLayout;
                }

                if (
                    this.dashboardLayout.length === 0 ||
                    Object.prototype.toString.call(this.dashboardLayout) !== '[object Array]'
                ) {
                    this.dashboardLayout = defaultLayout;
                }
            }

            let dashboardLayout = this.dashboardLayout || [];

            if (this.scope != null) {

                let dashboardLayoutName = this.scope.toLowerCase() + '-list';
                this.dashboardLayout = dashboardLayout = dashboardLayout.filter((value, index, arr) => {
                    return value.name.toLowerCase() === dashboardLayoutName;
                });
            }

            if (dashboardLayout.length === 0) {
                return;
            }

            if (dashboardLayout.length <= this.currentTab) {
                this.currentTab = 0;
            }

            let tabLayout = dashboardLayout[this.currentTab].layout || [];

            tabLayout = GridStack.Utils.sort(tabLayout);

            this.currentTabLayout = tabLayout;
        },

        storeCurrentTab: function (tab) {
            this.getStorage().set('state', 'dashboardTab', tab);
        },

        selectTab: function (tab) {
            this.$el.find('.page-header button[data-action="selectTab"]').removeClass('active');
            this.$el.find('.page-header button[data-action="selectTab"][data-tab="' + tab + '"]').addClass('active');

            this.currentTab = tab;
            this.storeCurrentTab(tab);

            this.setupCurrentTabLayout();

            this.dashletIdList.forEach(id => {
                this.clearView('dashlet-' + id);
            });

            this.dashletIdList = [];

            this.reRender();
        },

        setup: function () {
            this.scope = this.options.scope;
            this.currentTab = this.getStorage().get('state', 'dashboardTab') || 0;
            this.setupCurrentTabLayout();

            this.dashletIdList = [];

            this.screenWidthXs = this.getThemeManager().getParam('screenWidthXs');

            this.layoutReadOnly = true;

            if (this.getUser().isPortal()) {
                this.layoutReadOnly = true;
                this.dashletsReadOnly = true;
            } else {
                let forbiddenPreferencesFieldList = this.getAcl()
                    .getScopeForbiddenFieldList('Preferences', 'edit');

                if (~forbiddenPreferencesFieldList.indexOf('dashboardLayout')) {
                    this.layoutReadOnly = true;
                }

                if (~forbiddenPreferencesFieldList.indexOf('dashletsOptions')) {
                    this.dashletthis.gridsReadOnly = true;
                }
            }

            this.once('remove', () => {
                if (this.grid) {
                    this.grid.destroy();
                }

                if (this.fallbackModeTimeout) {
                    clearTimeout(this.fallbackModeTimeout);
                }

                $(window).off('resize.dashboard');
            });
        },

        afterRender: function () {
            this.$dashboard = this.$el.find('> .dashlets');

            if (window.innerWidth >= this.screenWidthXs) {
                this.initGridstack();
            } else {
                this.initFallbackMode();
            }

            $(window).off('resize.dashboard');
            $(window).on('resize.dashboard', this.onResize.bind(this));
        },

        onResize: function () {
            if (this.isFallbackMode() && window.innerWidth >= this.screenWidthXs) {
                this.initGridstack();
            } else if (!this.isFallbackMode() && window.innerWidth < this.screenWidthXs) {
                this.initFallbackMode();
            }
        },

        isFallbackMode: function () {
            return this.$dashboard.hasClass('fallback');
        },

        preserveDashletViews: function () {
            this.preservedDashletViews = {};
            this.preservedDashletElements = {};

            this.currentTabLayout.forEach(o => {
                let key = 'dashlet-' + o.id;
                let view = this.getView(key);

                this.unchainView(key);

                this.preservedDashletViews[o.id] = view;

                let $el = view.$el.children(0);

                this.preservedDashletElements[o.id] = $el;

                $el.detach();
            });
        },

        addPreservedDashlet: function (id) {
            let view = this.preservedDashletViews[id];
            let $el = this.preservedDashletElements[id];

            this.$el.find('.dashlet-container[data-id="' + id + '"]').append($el);

            this.setView('dashlet-' + id, view);
        },

        clearPreservedDashlets: function () {
            this.preservedDashletViews = null;
            this.preservedDashletElements = null;
        },

        hasPreservedDashlets: function () {
            return !!this.preservedDashletViews;
        },

        initFallbackMode: function () {
            if (this.grid) {
                this.grid.destroy(false);
                this.grid = null;

                this.preserveDashletViews();
            }

            this.$dashboard.empty();

            let $dashboard = this.$dashboard;

            $dashboard.addClass('fallback');

            this.currentTabLayout.forEach(o => {
                let $item = this.prepareFallbackItem(o);

                $dashboard.append($item);
            });

            this.currentTabLayout.forEach(o => {
                if (!o.id || !o.name) {
                    return;
                }

                if (!this.getMetadata().get(['dashlets', o.name])) {
                    console.error("Dashlet " + o.name + " doesn't exist or not available.");

                    return;
                }

                if (this.hasPreservedDashlets()) {
                    this.addPreservedDashlet(o.id);

                    return;
                }

                this.createDashletView(o.id, o.name);
            });

            this.clearPreservedDashlets();

            if (this.fallbackModeTimeout) {
                clearTimeout(this.fallbackModeTimeout);
            }

            this.$dashboard.css('height', '');

            this.fallbackControlHeights();
        },

        fallbackControlHeights: function () {
            this.currentTabLayout.forEach(o => {
                let $container = this.$dashboard.find('.dashlet-container[data-id="' + o.id + '"]');

                let headerHeight = $container.find('.panel-heading').outerHeight();

                let $body = $container.find('.dashlet-body');

                let bodyEl = $body.get(0);

                if (!bodyEl) {
                    return;
                }

                if (bodyEl.scrollHeight > bodyEl.offsetHeight) {
                    let height = bodyEl.scrollHeight + headerHeight;

                    $container.css('height', height + 'px');
                }
            });

            this.fallbackModeTimeout = setTimeout(() => {
                this.fallbackControlHeights();
            }, 300);
        },

        initGridstack: function () {
            if (this.dashboardLayout.length === 0) {
                return;
            }
            if (this.isFallbackMode()) {
                this.preserveDashletViews();
            }

            this.$dashboard.empty();


            let $gridstack = this.$gridstack = this.$dashboard;

            $gridstack.removeClass('fallback');

            if (this.fallbackModeTimeout) {
                clearTimeout(this.fallbackModeTimeout);
            }

            let disableDrag = false;
            let disableResize = false;

            if (this.getUser().isPortal() || this.getPreferences().get('dashboardLocked')) {
                disableDrag = true;
                disableResize = true;
            }


            let grid = this.grid = GridStack.init({
                    cellHeight: this.getThemeManager().getParam('dashboardCellHeight') * 1.14,
                    margin: this.getThemeManager().getParam('dashboardCellMargin') / 2,
                    column: 12,
                    handle: '.panel-heading',
                    disableDrag: disableDrag,
                    disableResize: disableResize,
                    disableOneColumnMode: true,
                    draggable: {
                        distance: 10,
                    },
                    dragInOptions: {
                        scroll: false,
                    },
                    float: false,
                    animate: false,
                    scroll: false,
                },
                $gridstack.get(0)
            );

            grid.removeAll();

            this.currentTabLayout.forEach(o => {
                let $item = this.prepareGridstackItem(o.id, o.name);

                if (!this.getMetadata().get(['dashlets', o.name])) {
                    return;
                }

                grid.addWidget(
                    $item.get(0), {
                        x: o.x * this.WIDTH_MULTIPLIER,
                        y: o.y,
                        w: o.width * this.WIDTH_MULTIPLIER,
                        h: o.height,
                    }
                );
            });

            $gridstack.find('.grid-stack-item').css('position', 'absolute');

            this.currentTabLayout.forEach(o => {
                if (!o.id || !o.name) {
                    return;
                }

                if (!this.getMetadata().get(['dashlets', o.name])) {
                    console.error("Dashlet " + o.name + " doesn't exist or not available.");

                    return;
                }

                if (this.hasPreservedDashlets()) {
                    this.addPreservedDashlet(o.id);

                    return;
                }

                this.createDashletView(o.id, o.name);
            });

            this.clearPreservedDashlets();

            this.grid.on('change', () => {
                this.fetchLayout();
                this.saveLayout();
            });

            this.grid.on('resizestop', (e) => {
                let id = $(e.target).data('id');
                let view = this.getView('dashlet-' + id);

                if (!view) {
                    return;
                }
                view.trigger('resize');
            });
        },

        fetchLayout: function () {
            let layout = _.map(this.$gridstack.find('.grid-stack-item'), el => {
                let $el = $(el);

                let x = $el.attr('gs-x');
                let y = $el.attr('gs-y');
                let h = $el.attr('gs-h');
                let w = $el.attr('gs-w');

                return {
                    id: $el.data('id'),
                    name: $el.data('name'),
                    x: x / this.WIDTH_MULTIPLIER,
                    y: y,
                    width: w / this.WIDTH_MULTIPLIER,
                    height: h,
                };
            });

            this.dashboardLayout[this.currentTab].layout = layout;
        },

        prepareGridstackItem: function (id, name) {
            let $item = $('<div>').addClass('grid-stack-item');
            let $container = $('<div class="grid-stack-item-content dashlet-container"></div>');

            $container.attr('data-id', id);
            $container.attr('data-name', name);

            $item.attr('data-id', id);
            $item.attr('data-name', name);

            $item.append($container);

            return $item;
        },

        prepareFallbackItem: function (o) {
            let $item = $('<div></div>');
            let $container = $('<div class="dashlet-container"></div>');

            $container.attr('data-id', o.id);
            $container.attr('data-name', o.name);
            $container.attr('data-x', o.x);
            $container.attr('data-y', o.y);
            $container.attr('data-height', o.height);
            $container.attr('data-width', o.width);
            $container.css('height', (o.height *
                this.getThemeManager().getParam('dashboardCellHeight')) + 'px');

            $item.attr('data-id', o.id);
            $item.attr('data-name', o.name);

            $item.append($container);

            return $item;
        },

        saveLayout: function (attributes) {
            if (this.layoutReadOnly) {
                return;
            }

            attributes = {
                ...(attributes || {}),
                ...{
                    dashboardLayout: this.dashboardLayout
                },
            };

            this.getPreferences().save(attributes, {
                patch: true
            });

            this.getPreferences().trigger('update');
        },

        removeDashlet: function (id) {
            let revertToFallback = false;

            if (this.isFallbackMode()) {
                this.initGridstack();

                revertToFallback = true;
            }

            let $item = this.$gridstack.find('.grid-stack-item[data-id="' + id + '"]');

            this.grid.removeWidget($item.get(0), true);

            let layout = this.dashboardLayout[this.currentTab].layout;

            layout.forEach((o, i) => {
                if (o.id === id) {
                    layout.splice(i, 1);
                }
            });

            let o = {};

            o.dashletsOptions = this.getPreferences().get('dashletsOptions') || {};

            delete o.dashletsOptions[id];

            o.dashboardLayout = this.dashboardLayout;

            if (this.layoutReadOnly) {
                return;
            }

            this.getPreferences().save(o, {
                patch: true
            });
            this.getPreferences().trigger('update');

            let index = this.dashletIdList.indexOf(id);

            if (~index) {
                this.dashletIdList.splice(index, index);
            }

            this.clearView('dashlet-' + id);

            this.setupCurrentTabLayout();

            if (revertToFallback) {
                this.initFallbackMode();
            }
        },

        addDashlet: function (name) {
            let revertToFallback = false;

            if (this.isFallbackMode()) {
                this.initGridstack();

                revertToFallback = true;
            }

            let id = 'd' + (Math.floor(Math.random() * 1000001)).toString();

            let $item = this.prepareGridstackItem(id, name);

            this.grid.addWidget(
                $item.get(0), {
                    x: 0,
                    y: 0,
                    w: 2 * this.WIDTH_MULTIPLIER,
                    h: 2,
                }
            );

            this.createDashletView(id, name, name, view => {
                this.fetchLayout();
                this.saveLayout();

                this.setupCurrentTabLayout();

                if (view.getView('body') && view.getView('body').afterAdding) {
                    view.getView('body').afterAdding.call(view.getView('body'));
                }

                if (revertToFallback) {
                    this.initFallbackMode();
                }
            });
        },

        createDashletView: function (id, name, label, callback, context) {
            context = context || this;

            let o = {
                id: id,
                name: name,
            };

            if (label) {
                o.label = label;
            }

            return this.createView('dashlet-' + id, 'views/dashlet', {
                label: name,
                name: name,
                id: id,
                el: this.options.el + ' > .dashlets .dashlet-container[data-id="' + id + '"]',
                readOnly: this.dashletsReadOnly,
                locked: this.getPreferences().get('dashboardLocked'),
            }, view => {
                this.dashletIdList.push(id);

                view.render();

                this.listenToOnce(view, 'change', () => {
                    this.clearView(id);

                    this.createDashletView(id, name, label, view => {});
                });

                this.listenToOnce(view, 'remove-dashlet', () => {
                    this.removeDashlet(id);
                });

                if (callback) {
                    callback.call(this, view);
                }
            });
        },

        editTabs: function () {
            let dashboardLocked = this.getPreferences().get('dashboardLocked');

            this.createView('editTabs', 'views/modals/edit-dashboard', {
                dashboardLayout: this.dashboardLayout,
                dashboardLocked: dashboardLocked,
                fromDashboard: true,
            }, view => {
                view.render();

                this.listenToOnce(view, 'after:save', data => {
                    view.close();

                    let dashboardLayout = [];

                    data.dashboardTabList.forEach(name => {
                        let layout = [];
                        let id = null;

                        this.dashboardLayout.forEach(d => {
                            if (d.name === name) {
                                layout = d.layout;
                                id = d.id;
                            }
                        });

                        if (name in data.renameMap) {
                            name = data.renameMap[name];
                        }

                        let o = {
                            name: name,
                            layout: layout,
                        };

                        if (id) {
                            o.id = id;
                        }

                        dashboardLayout.push(o);
                    });

                    this.dashletIdList.forEach(item => {
                        this.clearView('dashlet-' + item);
                    });

                    this.dashboardLayout = dashboardLayout;

                    this.saveLayout({
                        dashboardLocked: data.dashboardLocked,
                    });

                    this.storeCurrentTab(0);
                    this.currentTab = 0;
                    this.setupCurrentTabLayout();

                    this.reRender();
                });
            });
        },
    });
});

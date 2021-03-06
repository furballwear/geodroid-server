
format = new OpenLayers.Format.WMTSCapabilities({
    /**
     * This particular service is not in compliance with the WMTS spec and
     * is providing coordinates in y, x order regardless of the CRS.  To
     * work around this, we can provide the format a table of CRS URN that
     * should be considered y, x order.  These will extend the defaults on
     * the format.
     */
    yx: {
        "urn:ogc:def:crs:EPSG::900913": true
    }
});

function loadWMTS() {
    OpenLayers.Request.GET({
        url: "/wmts",
        params: {
            SERVICE: "WMTS",
            VERSION: "1.0.0",
            REQUEST: "GetCapabilities"
        },
        success: function(request) {
            var doc = request.responseXML;
            if (!doc || !doc.documentElement) {
                doc = request.responseText;
            }
            var capabilities = format.read(doc);
            for (var i = 0; i < capabilities.contents.layers.length; i++) {
                var lyr = capabilities.contents.layers[i];
                var layer = format.createLayer(capabilities, {
                    layer: lyr.identifier,
                    matrixSet: lyr.identifier,
                    format: "image/png",
                    isBaseLayer: true
                });
                layer.name = lyr.identifier + " [Local]";
                layer.events.register("visibilitychanged", {}, baseLayerToggled);
                map.addLayer(layer);
            }
        },
        failure: function() {
            alert("Trouble getting capabilities doc");
            OpenLayers.Console.error.apply(OpenLayers.Console, arguments);
        }
    });
}

function layerToggled() {
    updateExtent();
}

function updateExtent() {
    var proj = map.baseLayer.projection;
    var visible = $.map(map.layers, function(l) { return (l.visibility && !l.isBaseLayer) ? l: null });
    if (visible.length === 0) return;
    var extent = new OpenLayers.Bounds();
    $.each(visible, function(i, l) {
        var e = new OpenLayers.Bounds(l.llbbox);
        e.transform(l.projection, proj);
        extent.extend(e);
    });
    map.zoomToExtent(extent);
}

function baseLayerToggled() {
    updateExtent();
}

function loadWMS() {
    OpenLayers.Request.GET({
        url: "/wms",
        params: {
            SERVICE: "WMS",
            REQUEST: "GetCapabilities"
        },
        success: function(request) {
            var doc = request.responseXML;
            if (!doc || !doc.documentElement) {
                doc = request.responseText;
            }
            var capabilities = new OpenLayers.Format.WMSCapabilities().read(doc);
            var lyrs = capabilities.capability.layers;
            for (var i =0; i < lyrs.length; i++) {
                var lyr = lyrs[i];
                var wmsOptions = {
                    layers: lyr.name,
                    format: "image/png",
                    version: capabilities.version
                };
                var layerOptions = {
                    singleTile: true,
                    llbbox: lyr.llbbox,
                    isBaseLayer: false,
                    visibility: false
                };
                var layer = new OpenLayers.Layer.WMS(lyr.name, 
                    capabilities.capability.request.getmap.href, wmsOptions, layerOptions);
                layer.events.register("visibilitychanged", {}, layerToggled);
                map.addLayer(layer);
            }
        },
        failure: function() {
            alert("Trouble getting capabilities doc");
            OpenLayers.Console.error.apply(OpenLayers.Console, arguments);
        }
    });
}

function loadStyles() {
    $("#styles select option").filter(function() {
        return $(this).prop("disabled") != true;
    }).remove();

    $.ajax({
        url: "/styles"
    }).done(function(data) {
        var select = $("#styles select");
        $(Object.keys(data)).each(function(i,v) {
            $("<option>", { value: v, html: v}).appendTo(select);
        });
        select.change(function() {
            var style = $(this).val();
            $(map.layers).filter(function() {
                return !this.isBaseLayer && 
                    this.initialize.prototype.CLASS_NAME == "OpenLayers.Layer.WMS"
            }).each(function(i,layer) {
                layer.mergeNewParams({
                    STYLES: style
                })
            });
        }); 
    })
}

function init() {
    map = new OpenLayers.Map({
        div: "map"
    });

    function addBaseLayer(layer) {
        layer.events.register("visibilitychanged", {}, baseLayerToggled);
        map.addLayer(layer);
    }

    addBaseLayer(new OpenLayers.Layer.WMS("OSM 4326", "http://maps.opengeo.org/geowebcache/service/wms",
        {layers: "openstreetmap", crs: "EPSG:4326", format: "image/png"}));
    addBaseLayer(new OpenLayers.Layer.OSM());
    var switcher = new OpenLayers.Control.LayerSwitcher({div:$("#layer-switcher")[0]});
    // awful hack to prevent multiple events on devices
    switcher.ignore = false;
    switcher._onButtonClick = switcher.onButtonClick;
    switcher.onButtonClick = function(evt) {
        if (this.ignore) return;
        this.ignore = true;
        window.setTimeout(function() {
            switcher.ignore = false;
        }, 500);
        this._onButtonClick(evt);
    };
    map.addControl(switcher);
    map.zoomTo(1);

    loadWMTS();
    loadWMS();

    $("#layers").hide();
    $("#layers-button").click(function() {
        $("#layers").toggle();
    });
    $("#layers .close").click(function() {
        $("#layers").hide();
    });
    $("#styles .icon-refresh").click(function() {
        loadStyles();
    });
    loadStyles();
}



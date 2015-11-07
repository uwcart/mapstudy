//Map panel

/************** M-isomorph ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend();

//MODELS NEEDED
//-layers for each isomorph and each library
//-interaction elements and strategies for each interaction

/************** M-library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	events: {
		//DOM events--not sure I'll use this
	},
	initialize: function(options){
		//attach an event for each interaction--remember to have user interaction trigger on map
		_.each(this.model.get('interactions'), function(interaction){
			this.on(interaction, this.recordInteraction);
		}, this);

		this.options = options || {};
	},
	render: function(){
		this.$el.html("<div id='map'>");
		return this;
	},
	setMap: function(){
		//remove default zoom control and interactions if noZoom option is true
		if (this.model.get('mapOptions.noZoom')){
			this.model.set('mapOptions.zoomControl', false);
			this.model.set('mapOptions.touchZoom', false);
			this.model.set('mapOptions.scrollWheelZoom', false);
			this.model.set('mapOptions.doubleClickZoom', false);
			this.model.set('mapOptions.boxZoom', false);
		};

		//add initial map layers
		var layers = [];
		var baseTiles = L.tileLayer(this.model.get('baseTiles.url'), this.model.get('baseTiles.layerOptions'));
		layers.push(baseTiles);
		var dataLayerModel = eval("new " + this.model.get('dataLayer.isomorph.type') + "()"); //get model based on isomorph type--this seems like the best approach?`
		layers.push(dataLayerModel.get('layer'));
		// this.model.set('mapOptions.layers', layers);

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//layers control
		var baseLayers = {}, overlays = {};
		//add any additional base layers
		if (this.model.get('altTiles') && this.model.get('altTiles').length > 0){
			_.each(this.model.get('altTiles'), function(layerProps){
				baseLayers[layerProps.name] = L.tileLayer(layerProps.url, layerProps.layerOptions);
			});
		};
		if ($.isEmptyObject(baseLayers)){ baseLayers = null };
		//add any additional data layers
		if (this.model.get('dataOverlays') && this.model.get('dataOverlays').length > 0){
			_.each(this.model.get('dataOverlays'), function(layerProps){
				var dataOverlayModel = new eval(layerProps.isomorph.type);
				overlays[layerProps.name] = dataOverlayModel.get('layer');
			});
		};
		if ($.isEmptyObject(overlays)){ overlays = null };
		//add layers control if needed
		if (baseLayers || overlays){
			L.control.layers(baseLayers, overlays).addTo(this.map);
		};
	},
	recordInteraction: function(interaction){
		console.log(interaction);
		//send the interaction, timestamp, etc. to the interactions database table
	}
});

function setMapView(options){
	var mapView = eval("new " + options.get('library') + "Map({model: options})");
	mapView.render().setMap();
};

/************** M-options ****************/

var MapOptions = Backbone.DeepModel.extend({
	url: "config/map.json"
});

//get options
var options = new MapOptions();
options.on('sync', setMapView);
options.fetch();
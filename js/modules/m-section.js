//Map panel

(function(){

/************** map.dataLayer.techique.classification ****************/

var Quantile = Backbone.Model.extend({
	defaults: {
		type: 'quantile'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign array of values as scale domain
		scale.domain(values);
		//done
		return scale;
	}
});

var EqualInterval = Backbone.Model.extend({
	defaults: {
		type: 'equal interval'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

var NaturalBreaks = Backbone.Model.extend({
	defaults: {
		type: 'natural breaks'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.threshold()
			.range(classes);
		//cluster data using ckmeans clustering algorithm to create natural breaks
		var clusters = ss.ckmeans(values, classes.length);
		//set domain array to cluster minimums
		var domainArray = clusters.map(function(d){
			return d3.min(d);
		});
		//remove first value from domain array to create class breakpoints
		domainArray.shift();
		//assign array of remaining cluster minimums as domain
		scale.domain(domainArray);
		//done
		return scale;
	}
});

var Unclassed = Backbone.Model.extend({
	defaults: {
		type: 'unclassed'
	},
	scale: function(values, rangeBounds){
		//create scale generator
		var scale = d3.scale.linear()
			.range(rangeBounds);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

//a single collection holds all classification models
var classification = new Backbone.Collection([
	new Quantile(),
	new EqualInterval(),
	new NaturalBreaks(),
	new Unclassed()
]);

/************** map.dataLayer.technique ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend({
	defaults: {
		techniqueType: 'choropleth',
		classificationType: '',
		expressedAttribute: '',
		classes: [],
		dataLayer: {}
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//set a new fillColor property for each feature with the class color value
		return {
			fillColor: scale(parseFloat(feature.properties[expressedAttribute]))
		};
	},
	setClasses: function(){
		var expressedAttribute = this.get('expressedAttribute');
		//get all of the values for the attribute by which the data will be classed
		var values = _.map(this.get('features'), function(feature){
			return parseFloat(feature.properties[expressedAttribute]);
		});
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: this.get('classificationType')})[0];
		var scale = classificationModel.scale(values, this.get('classes'));
		//use scale and attribute to set layer options
		_.each(this.get('features'), function(feature){
			feature.properties.layerOptions = this.setLayerOptions(feature, scale, expressedAttribute);
		}, this);
		this.trigger('done');
	},
	initialize: function(){
		this.on('sync', this.setClasses);
	}
});

//model for proportional symbol data overlay
var ProportionalSymbol = Choropleth.extend({
	defaults: {
		techniqueType: 'proportional symbol',
		symbol: 'circle'
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//set a new radius property for each feature with the class color value
		return {
			radius: scale(parseFloat(feature.properties[expressedAttribute]))
		};
	}
});

//a single collection holds all visual techniques
var techniques = new Backbone.Collection([
	new Choropleth(),
	new ProportionalSymbol()
]);

/************** map.interactions ****************/

//basic interaction model
var Interaction = Backbone.Model.extend({
	defaults: {
		interaction: "",
		timestamp: "",
		userId: userId,
		question: 0
	},
	url: "php/interactions.php",
	record: function(){
		var date = new Date();
		this.set({
			timestamp: date.toUTCString(),
			question: question
		});
		this.save();
	},
	create: function(events){
		//events is an object in the form of {event1: context1, event2: context2}
		for (var e in events){
			var context = events[e];
			var model = this;
			context.on(e, function(){
				model.record();
			});
		}
	}
});

//model for filter interaction
var FilterModel = Backbone.Model.extend({
	defaults: {
		attributes: [],
		tool: "slider",
		features: {}
	}
});

//slider view for filter interaction
var FilterSliderView = Backbone.View.extend({
	el: ".filter-control-container",
	events: {
		"click img": "open",
		"click .close": "close"
	},
	template: _.template( $( '#slider-template').html() ),
	applyFilter: function(){},
	getAllAttributeValues: function(attribute){
		//get attribute values for all features with given attribute
		var allAttributeValues = [];

		_.each(this.model.get('features'), function(feature){
			if (feature.properties[attribute]){
				allAttributeValues.push(parseFloat(feature.properties[attribute]));
			};
		}, this);

		//ensure array only includes numbers
		allAttributeValues = _.filter(allAttributeValues, function(value){
			return !isNaN(value);
		});
		//sort array and return
		allAttributeValues.sort(function(a,b){ return a-b });
		return allAttributeValues;
	},
	setSlider: function(attribute){
		//get attribute values for all features with given attribute
		var allAttributeValues = this.getAllAttributeValues(attribute);
		//set values for slider
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues),
			mindiff = _.reduce(allAttributeValues, function(memo, val, i){
				//take the smallest possible difference between attribute values to determine step
				if (i < allAttributeValues.length-1){
					var diff = Math.abs(val - allAttributeValues[i+1]);
					if (diff == 0){ return memo };
					return memo < diff ? memo : diff;
				} else {
					return memo;
				};
			}, Infinity),
			step = 0;
		//assign step the order of magnitude of mindiff
		if (mindiff >= 1){
			var intLength = String(Math.round(mindiff)).length;
			step = Math.pow(10,intLength-1);
		} else {
			for (var i=12; i>0; i--){
				if (mindiff * Math.pow(10,i) >= 1){
					step = Math.pow(10,-i);
				};
			};
			if (step == 0){
				step = 1 * Math.pow(10,-12);
			};
		};
		//add a small amount of padding to ensure max and min values stay within range
		min = Math.floor(min / step) * step - step;
		max = Math.ceil(max / step) * step + step;
		//add labels
		var labelsDiv = this.$el.find("#"+attribute+"-labels");
		labelsDiv.children(".left").html(min);
		labelsDiv.children(".right").html(max);
		//to pass to slide callback
		var applyFilter = this.applyFilter;
		//set slider
		this.$el.find("#"+attribute+"-slider").slider({
			range: true,
			min: min, //change
			max: max, //change
			values: [min, max], //change
			step: step, //change
			slide: function(e, slider){
				labelsDiv.children(".left").html(slider.values[0]);
				labelsDiv.children(".right").html(slider.values[1]);
				applyFilter(attribute, slider.values);
			}
		});
	},
	append: function(attribute){
		this.$el.append(this.template({attribute: attribute}));
		this.setSlider(attribute);
	},
	render: function(){
		//add a filter tool for each attribute
		_.each(this.model.get('attributes'), function(attribute){
			//only proceed if attribute is actually numerical
			var allAttributeValues = this.getAllAttributeValues(attribute);
			if (allAttributeValues.length > 0){
				this.append(attribute);
			};
		}, this);
		this.$el.append('<a class="close">&times;</a>');
		this.$el.children('.close').css({
			'position': 'absolute',
			'left': this.$el.width() - 20 + "px",
			'top': "0px",
			'color': '#333'
		});
		this.$el.children('.filter-row, .close').each(function(){
			$(this).hide();
		});
		this.$el.css('cursor', 'pointer');
	},
	open: function(e){
		//show content
		this.$el.children('.filter-row, .close').each(function(){
			$(this).show();
		});
		this.$el.css('cursor', 'default');
	},
	close: function(){
		//hide content
		this.$el.children('.filter-row, .close').each(function(){
			$(this).hide();
		});
		this.$el.css('cursor', 'pointer');
	},
	initialize: function(options){
		this.applyFilter = options.applyFilter;
	}
});

//logic view for filter interaction
var FilterLogicView = FilterSliderView.extend({
	events: function(){
		return _.extend({}, FilterSliderView.prototype.events,{
			"keyup input": "processFilter"
		});
	},
	template: _.template( $( '#logic-template').html() ),
	processFilter: function(e){
		//identify attribute
		var attributeDiv = $(e.target).parent();
		var attribute = attributeDiv.attr('id').split('-')[0];
		//get attribute values min and max
		var allAttributeValues = this.getAllAttributeValues(attribute);
		var minmax = [_.min(allAttributeValues), _.max(allAttributeValues)];
		//array to hold filter values
		var values = [
			attributeDiv.children('input[name=value1]').val(),
			attributeDiv.children('input[name=value2]').val(),
		];
		//test whether input contains a value; if not, use default
		values = _.map(values, function(value, i){
			return value.length > 0 ? parseFloat(value) : minmax[i];
		});
		//go!
		this.applyFilter(attribute, values);
	},
	setValues: function(attribute){
		//get attribute values for all features with given attribute
		var allAttributeValues = this.getAllAttributeValues(attribute);
		//set values for inputs
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues);
		this.$el.find('input[name=value1]').attr('placeholder', min);
		this.$el.find('input[name=value2]').attr('placeholder', max);
	},
	append: function(attribute){
		this.$el.append(this.template({attribute: attribute}));
		this.setValues(attribute);
	}
});

var ReexpressModel = Backbone.Model.extend({
	defaults: {
		className: '',
		iconName: '',
		techniqueType: ''
	}
});

var ReexpressView = Backbone.View.extend({
	tagName: 'button',
	events: {
		"click": "setTechnique"
	},
	setTechnique: function(e){
		console.log('you clicked ',e);
	},
	render: function(){
		this.$el.attr({
			class: this.model.get('className'),
			type: 'button'
		});
		this.$el.html('<img class="icon" src="img/icons/'+ this.model.get('iconName') +'.png">'+ this.model.get('techniqueType'));
		return this.$el[0].outerHTML;
	}
});


/************** map.library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	initialize: function(){

	},
	render: function(){
		this.$el.html("<div id='map'>");
		return this;
	},
	setBaseLayer: function(baseLayer, i){
		//create leaflet tile layer
		var leafletBaseLayer = L.tileLayer(baseLayer.source, baseLayer.layerOptions);
		leafletBaseLayer.layerName = baseLayer.name;
		//only add first base layer to the map
		if (i==0){ leafletBaseLayer.addTo(this.map); };
		//add to array of base layers
		this.model.attributes.leafletBaseLayers.push(leafletBaseLayer);
		//trigger done event
		if (i == this.model.get('baseLayers').length-1){ this.trigger('baseLayersDone') };
	},
	setDataLayer: function(dataLayer, i){
		//get layer options
		var dataLayerOptions = dataLayer.layerOptions;
		//get model based on technique type
		var dataLayerModel = techniques.where({techniqueType: dataLayer.techniques[0].type})[0];
		//pass in necessary values
		dataLayerModel.set({
			classificationType: dataLayer.techniques[0].classification,
			expressedAttribute: dataLayer.expressedAttribute,
			classes: dataLayer.techniques[0].classes,
			dataLayer: dataLayer
		});
		//set up AJAX callback
		dataLayerModel.on('done', function(){
			var model = this.model, view = this;
			var layerName = dataLayerModel.get('dataLayer').name;
			var className = layerName.replace(/\s|\:/g, '-');
			function style(feature){
				//combine layer options objects from config file and feature properties
				//classification will take precedence over base options
				return _.defaults(feature.properties.layerOptions, dataLayerOptions);
			};
			//implement retrieve interaction if listed in config file
			function onEachFeature(feature, layer){
				feature.layer = layer; //bind layer to feature for search
				if (model.get('interactions.retrieve')){
					var popupContent = "<table>";
					if (dataLayer.retrieveAttributes){
						dataLayer.retrieveAttributes.forEach(function(attr){
							popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
						});
					} else {
						var attr = dataLayerModel.get('expressedAttribute');
						popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
					};
					popupContent += "</table>";
					layer.bindPopup(popupContent);
					if (model.get('interactions.retrieve.event') == 'hover'){
						layer.on({
							mouseover: function(){
								//fix for popup flicker
								var bounds = this.getBounds();
								var maxLat = bounds.getNorth();
								var midLng = bounds.getCenter().lng;
								this.openPopup([maxLat, midLng]);
							},
							mouseout: function(){ this.closePopup() }
						});
					};
					layer.on('popupopen', function(){
						view.trigger('popupopen');
					});
				};
			};
			//implement pointToLayer conversion for proportional symbol maps
			function pointToLayer(feature, latlng){
				var markerOptions = _.extend(feature.properties.layerOptions, dataLayerOptions);
				if (dataLayerModel.get('symbol') == 'circle'){
					return L.circleMarker(latlng, markerOptions);
				} else {
					var width = markerOptions.radius * 2;
					var icon = L.icon({
						iconUrl: dataLayerModel.get('symbol'),
						iconSize: [width, width]
					});
					return L.marker(latlng, {icon: icon})
				};	
			};
			//add Leaflet overlay
			var overlayOptions = {
				onEachFeature: onEachFeature,
				style: style,
				className: className
			};
			if (dataLayerModel.get('techniqueType') == 'proportional symbol'){
				overlayOptions.pointToLayer = pointToLayer;
			};
			var leafletDataLayer = L.geoJson(dataLayerModel.get('features'), overlayOptions);
			leafletDataLayer.layerName = layerName;
			//render immediately by default
			if (typeof dataLayer.renderOnLoad === 'undefined' || dataLayer.renderOnLoad == 'true'){
				leafletDataLayer.addTo(this.map);
				//reset cursor if needed
				if (!model.get('interactions.retrieve') && model.get('interactions.pan')){
					$("."+className).css('cursor', "grab");
				};
			};
			//add to layers
			model.attributes.leafletDataLayers.push(leafletDataLayer);
			//trigger done event
			if (i == model.get('dataLayers').length-1){ this.trigger('dataLayersDone') };
		}, this);
		//go get the data!
		dataLayerModel.fetch({url: dataLayer.source});
	},
	getFeatures: function(){
		//collect all dataLayers' features in one features array
		var features = [];
		_.each(this.model.get('leafletDataLayers'), function(dataLayer){
			var geoJsonFeatures = dataLayer.toGeoJSON().features;
			features = features.concat(geoJsonFeatures);
		}, this);
		return features;
	},
	addOverlayControl: function(){
		//add layer control if it wasn't created for underlay
		if (!this.layerControl){
			this.layerControl = L.control.layers().addTo(this.map);
		};
		//add each overlay to layers control
		_.each(this.model.get('leafletDataLayers'), function(overlay){
			//only add listed layers
			if (_.indexOf(this.model.get('interactions.overlay.dataLayers'), overlay.layerName) > -1){
				//for reexpress interaction, replace overlay.layerName with html for icon buttons
				if (this.model.get('interactions.reexpress')){
					overlay.layerName = this.addReexpress(overlay.layerName);
				};
				this.layerControl.addOverlay(overlay, overlay.layerName);
			};
		}, this);
	},
	addUnderlayControl: function(){
		//add layer control if it wasn't created for overlay
		if (!this.layerControl){
			this.layerControl = L.control.layers().addTo(this.map);
		};
		//add each base layer to layers control
		_.each(this.model.get('leafletBaseLayers'), function(baseLayer){
			this.layerControl.addBaseLayer(baseLayer, baseLayer.layerName);
		}, this);
	},
	addSearch: function(){
		var model = this.model;
		function showResultFct(feature, container){
			props = feature.properties;
	        _.each(model.get('interactions.search.attributes'), function(attribute){
	        	var span = L.DomUtil.create('span', null, container);
	        	span.innerHTML = "<b>"+attribute+"</b>: "+props[attribute]+"<br>";
	        }, this);
		}
		//add search control to map
		var searchControl = L.control.fuseSearch({
			position: 'topleft',
			showResultFct: showResultFct
		}).addTo(this.map);
		//get features array
		var features = this.getFeatures();
		//index features for search
		searchControl.indexFeatures(features, this.model.get('interactions.search.attributes'));
		//add search event
		var view = this,
			timeout = window.setTimeout(function(){}, 0);
		$(".search-input").on('keyup', function(){ 
			clearTimeout(timeout);
			timeout = window.setTimeout(function(){ view.trigger('search'); }, 1000)
		});
	},
	addFilter: function(){
		var model = this.model;
		var map = this.map;
		//extend Leaflet controls to create filter control
		var FilterControl = L.Control.extend({
			options: {
				position: 'bottomleft'
			},
			onAdd: function(map){
				//create container for filter control
				var container = L.DomUtil.create('div', 'filter-control-container control-container');
				container.innerHTML = '<img src="js/lib/leaflet/images/filter.png">';
				//kill map interactions under filter control
				L.DomEvent.addListener(container, 'mousedown click dblclick', function(e) {
					L.DomEvent.stopPropagation(e);
				});
				return container;
			}
		});
		//add filter control to map
		map.addControl(new FilterControl());

		//applyFilter function references map, so must be created here
		var applyFilter = function(attribute, values){
			//global array to hold map layers removed
			if (!window.offLayers){ window.offLayers = []; };
			//helpful abbreviations
			var min = values[0], max = values[1];
			//attribute is stored in slider div id
			// var attribute = $(e.target).attr('id').split('-')[0];
			map.eachLayer(function(layer){
				if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
					var layerValue = layer.feature.properties[attribute];
					//if value falls outside range, remove from map and stick in removed layers array
					if (layerValue < min || layerValue > max){
						map.removeLayer(layer);
						offLayers.push(layer);
					};
				};
			});
			_.each(offLayers, function(layer){
				if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
					var layerValue = layer.feature.properties[attribute];
					//if value within range, add to map and remove from removed layers array
					if (layerValue > min && layerValue < max){
						layer.addTo(map);
						offLayers = _.without(offLayers, layer);
					};
				};
			});
		};

		_.each(model.get('leafletDataLayers'), function(dataLayer){
			//get filter properties
			var attributes = model.get('interactions.filter.attributes');
			var controlType = model.get('interactions.filter.tool');
			//set a tool for each filter attribute
			var filterModel = new FilterModel({attributes: attributes, tool: controlType, map: this.map, features: this.getFeatures()});
			//filter view options
			var filterViewOptions = {
				model: filterModel, 
				applyFilter: applyFilter
			};
			//create filter view
			var filterView = controlType == 'logic' ? new FilterLogicView(filterViewOptions) : new FilterSliderView(filterViewOptions);
			filterView.render();
		}, this);
		//trigger filter event on slider stop or logic filter entry
		var view = this, 
			timeout = window.setTimeout(function(){}, 0);
		$('.range-slider').on('slidestop', function(){ view.trigger('filter'); });
		$('.filter-row input').on('keyup', function(){
			clearTimeout(timeout);
			timeout = window.setTimeout(function(){ view.trigger('filter'); }, 1000);
		});
	},
	addReexpress: function(layerName){
		var techniques = _.findWhere(this.model.get('dataLayers'), {name: layerName}).techniques;
		//if multiple available techniques, add button for each
		if (techniques.length > 1){
			var layerNameHtml = layerName +': ';
			_.each(techniques, function(technique, i){
				var className = i == 0 ? 'active' : 'inactive';
				// var reexpressButton = new ReexpressView({
				// 	model: new ReexpressModel({
				// 		className: className,
				// 		iconName: technique.type.replace(' ', '_'),
				// 		techniqueType: technique.type
				// 	})
				// });
				// layerNameHtml += reexpressButton.render();
				
				layerNameHtml += '<button type="button" class="'+ className +'"><img class="icon" src="img/icons/'+ technique.type.replace(' ', '_') +'.png">'+ technique.type +'</button>'; 
			}, this);
			//add reexpress buttons to layers control
			return layerNameHtml;
		} else {
			//no buttons
			return layerName;
		};
	},
	reexpress: function(e){
		console.log('reexpress ', e);
	},
	setMapInteractions: function(){
		//remove default zoom control and interactions if no zoom interaction
		if (!this.model.get('interactions.zoom')){
			this.model.set('mapOptions.zoomControl', false);
			this.model.set('mapOptions.touchZoom', false);
			this.model.set('mapOptions.scrollWheelZoom', false);
			this.model.set('mapOptions.doubleClickZoom', false);
			this.model.set('mapOptions.boxZoom', false);
		};
		//remove default panning interaction if no pan interaction
		if (!this.model.get('interactions.pan')){
			this.model.set('mapOptions.dragging', false);
		};
		//set layers control for overlay interaction
		if (this.model.get('interactions.overlay') && this.model.get('interactions.overlay.dataLayers') && this.model.get('interactions.overlay.dataLayers').length > 0){
			this.on('dataLayersDone', this.addOverlayControl, this);
		};
		//set layers control for underlay interaction
		if (this.model.get('interactions.underlay')){
			this.on('baseLayersDone', this.addUnderlayControl, this);
		};
		//set search control for search interaction
		if (this.model.get('interactions.search') && this.model.get('interactions.search.attributes') && this.model.get('interactions.search.attributes').length > 0){
			this.on('dataLayersDone', this.addSearch, this);
		};
		//set filter control for filter interaction
		if (this.model.get('interactions.filter') && this.model.get('interactions.filter.attributes') && this.model.get('interactions.filter.attributes').length > 0){
			this.on('dataLayersDone', this.addFilter, this);
		};
	},
	logInteractions: function(){
		//designate events to listen to with contexts for each interaction
		var interactionCreation = {
			zoom: {zoomstart: this.map},
			pan: {dragend: this.map},
			retrieve: {popupopen: this},
			overlay: {overlayadd: this.map, overlayremove: this.map},
			underlay: {baselayerchange: this.map},
			search: {search: this},
			filter: {filter: this}
		};
		//create a new interaction object for each interaction with logging
		var interactions = this.model.get('interactions');
		for (var interaction in interactionCreation){
			if (interactions[interaction] && interactions[interaction].logging){
				var i = new Interaction({interaction: interaction});
				i.create(interactionCreation[interaction]);
			};
		};
	},
	setMap: function(){
		//configure map interactions
		this.setMapInteractions();
		//create Leaflet layers arrays
		this.model.set({
			leafletBaseLayers: [],
			leafletDataLayers: []
		});

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//add initial tile layers
		var baseLayers = this.model.get('baseLayers');
		_.each(baseLayers, this.setBaseLayer, this);

		//add each data layer
		var dataLayers = this.model.get('dataLayers');
		_.each(dataLayers, this.setDataLayer, this);

		//set interaction logging
		this.logInteractions();
	}
});

/************** set map view ****************/

function setMapView(options){
	var mapView = eval("new " + options.get('library') + "Map({model: options})");
	mapView.render().setMap();
};

/************** map config ****************/

var MapConfig = Backbone.DeepModel.extend({
	url: "config/map.json"
});

//get map configuration options
var mapConfig = new MapConfig();
mapConfig.on('sync', setMapView);
mapConfig.fetch();

})();
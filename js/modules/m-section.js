//Map panel

(function(){

/************************ helper functions ***************************/

//produce numeric values array from GeoJSON features
function getAllAttributeValues(features, attribute){
	//get attribute values for all features with given attribute
	var values = _.map(features, function(feature){
		return parseFloat(feature.properties[attribute]);
	});
	//strip any NaNs and sort
	values = _.without(values, NaN);
	values.sort(function(a,b){ return a-b });
	return values;
};

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
		var values = getAllAttributeValues(this.get('features'), expressedAttribute);
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: this.get('classificationType')})[0];
		var scale = classificationModel.scale(values, this.get('classes'));
		//use scale and attribute to set layer options
		_.each(this.get('features'), function(feature){
			feature.properties.layerOptions = this.setLayerOptions(feature, scale, expressedAttribute);
		}, this);
		this.set('scale', scale);
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
		//ensure scale range values are numbers
		var range = _.map(scale.range(), function(val){
			return parseFloat(val);
		});
		scale.range(range);
		//set a new radius property for each feature with the class radius
		return {
			radius: scale(parseFloat(feature.properties[expressedAttribute]))
		};
	}
});

//an object references technique classes to their types
var techniquesObj = {
	'choropleth': Choropleth,
	'proportional symbol': ProportionalSymbol
};

//view for legend creation
var LegendLayerView = Backbone.View.extend({
	tagName: 'svg',
	id: function(){
		return this.model.get('dataLayer').name.replace(/\s|\:/g, '-') + '-' + this.model.get('techniqueType').replace(/\s|\:/g, '-') + '-legend';
	},
	append: function(range, domain, i){
		var techniqueType = this.model.get('techniqueType');
		template = _.template( $('#'+techniqueType.replace(/\s|\:/g, '-')+'-legend-template').html() );
		//set y attribute as function of index
		var y = i * 12;
		var attributes = {
			range: range,
			y: y,
			svgHeight: this.model.get('svgHeight')
		};
		//set label content
		if (typeof domain == 'object'){
			attributes.label = domain[0] + ' - ' + domain[1];
		} else {
			attributes.label = String(domain)
		};
		//create temporary span element to test label width
		var labelTestSpan = $('<span class="leaflet-container">'+attributes.label+'</span>').appendTo('body');
		var labelWidth = labelTestSpan.width() + 5;
		labelTestSpan.remove();
		//set circle x for prop symbol legend and svgWidth for both
		if (this.model.get('maxRadius')){
			attributes.cx = this.model.get('maxRadius') + 10;
			attributes.svgWidth = labelWidth + attributes.cx * 2;
		} else {
			attributes.svgWidth = labelWidth + 40;
		};
		//reset svg width based on current width
		if (!this.model.get('svgWidth') || attributes.svgWidth > this.model.get('svgWidth')){
			this.model.set('svgWidth', attributes.svgWidth);
		};
		//append a symbol for each class
		var newline = template(attributes);
		this.$el.append(newline);
	},
	render: function(){
		//append svg to legend container
		$('.legend-control-container').append(this.$el);
	},
	initialize: function(){
		//get output range and input domain values
		var scale = this.model.get('scale'),
			range = scale.range().reverse(),
			domain = scale.domain().reverse();
		//get expressed attribute
		var expressedAttribute = this.model.get('expressedAttribute');
		//calculate svg height
		if (!isNaN(parseFloat(range[0]))){ //if range is a number, treat as prop symbol
			//set max radius
			this.model.set('maxRadius', parseFloat(range[0]));
			//svg height should be whichever is larger, label heights or largest circle diameter
			var heightArray = [
				13 * range.length + 6, 
				parseFloat(range[0]) * 2 + 6
			];
			heightArray.sort(function(a,b){ return b-a });
			this.model.set('svgHeight', heightArray[0]);
		} else {
			this.model.set('svgHeight', 13 * range.length + 6);
		};
		//only build classes for classed classification
		if (domain.length > 2 || range.length > 2){
			//add a symbol for each class
			_.each(range, function(rangeval, i){
				var domainvals = scale.invertExtent(rangeval);
				//fill in min and max values for natural breaks threshold scale
				if (typeof domainvals[0] == 'undefined'){
					domainvals[0] = d3.min(getAllAttributeValues(this.model.get('features'), expressedAttribute));
				} else if (typeof domainvals[1] == 'undefined'){
					domainvals[1] = d3.max(getAllAttributeValues(this.model.get('features'), expressedAttribute));
				};
				//add visual element and label for each class
				this.append(rangeval, domainvals, i);
			}, this);
		} else {
			//add a symbol for lowest and highest values
			_.each(range, function(rangeval, i){
				this.append(rangeval, domain[i], i);
			}, this)
		};
		//set svg dimensions
		this.$el.attr({
			width: this.model.get('svgWidth'),
			height: this.model.get('svgHeight'),
			xmlns: 'http://www.w3.org/2000/svg',
			version: '1.1'
		});
		//style according to layer options
		var css = {},
			layerOptions = this.model.get('dataLayer').layerOptions;
		for (var option in layerOptions){
			//assign options that may apply
			css[option] = layerOptions[option];
			//deal with special Leaflet options
			switch (option){
				case 'fillColor': css.fill = layerOptions[option]; break;
				case 'fillOpacity': css['fill-opacity'] = layerOptions[option]; break;
				case 'color': css.stroke = layerOptions[option]; break;
				case 'weight': css['stroke-width'] = layerOptions[option]; break;
				case 'opacity': css['stroke-opacity'] = layerOptions[option]; break;
				case 'dashArray': css['stroke-dasharray'] = layerOptions[option]; break;
				case 'linecap': css['stroke-linecap'] = layerOptions[option]; break;
				case 'linejoin': css['stroke-linejoin'] = layerOptions[option]; break;
			};
		};
		for (var style in css){
			this.$el.children('rect').each(function(){
				//don't override rectangle color
				if (style != 'fill'){ $(this).css(style, css[style]); };
			});
			this.$el.children('circle').each(function(){
				$(this).css(style, css[style]);
			});
		};
	}
});

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

var InteractionControlModel = Backbone.Model.extend({
	defaults: {
		interaction: ''
	}
});

//view for all interaction control toggle buttons
var InteractionToggleView = Backbone.View.extend({
	el: '.interaction-control-container',
	template: _.template( $('#interaction-control-template').html() ),
	message: '',
	addInteraction: function(){},
	removeInteraction: function(){},
	toggle: function(e, addInteraction, removeInteraction, message){
		//get target and interaction
		var target = $(e.target).attr('class') ? $(e.target) : $(e.target).parent(),
			className = target.attr('class'),
			interaction = className.split('-')[0];
		//toggle
		if (className.indexOf(' active') > -1){
			//close associated interaction widget
			$('.'+interaction+'-control-container').hide();
			//remove active class
			target.attr('class', className.substring(0, className.indexOf(' active')));
			//remove any additional interaction scripts
			removeInteraction();
		} else {
			//open associated interaction widget
			$('.'+interaction+'-control-container').show();
			//add active class
			target.attr('class', className + ' active');
			//add any additional interaction scripts
			addInteraction();
		};
		//display message about the interaction on first click
		if (message){ alert(message); };
	},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
		var toggle = this.toggle,
			addInteraction = this.addInteraction,
			removeInteraction = this.removeInteraction,
			message = this.message,
			firstClick = true;
		this.$el.children('.'+this.model.get('interaction')+'-control').click(function(e){
			//only display message on first click
			message = message.length > 0 && firstClick ? message : false;
			toggle(e, addInteraction, removeInteraction, message);
			firstClick = false;
		});
	},
	initialize: function(){
		return this;
	}
});

//interaction control base view
var InteractionControlView = Backbone.View.extend({
	render: function(){
		this.$el.append(this.template());
	},
	initialize: function(){
		this.render();
		return this;
	}
});

//view for pan interaction
var PanControlView = InteractionControlView.extend({
	el: '.pan-control-container',
	events: {
		'click .pan-button': 'pan'
	},
	template: _.template( $('#pan-control-template').html() ),
	pan: function(e){
		var targetId = $(e.target).attr('id') ? $(e.target).attr('id') : $(e.target).parent().attr('id');
		this.trigger('pan', targetId);
	}
});

//model for overlay control
var OverlayControlModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		layerId: '',
		techniqueType: ''
	}
});

//view for overlay control
var OverlayControlView = Backbone.View.extend({
	el: '.overlay-control-container',
	events: {
		'click input': 'overlay'
	},
	template: _.template( $('#overlay-control-template').html() ),
	toggleLayer: function(layerId, addLayer){},
	overlay: function(e){
		this.toggleLayer($(e.target).val(), $(e.target).prop('checked'));
	},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
	}
});

//model for underlay control
var UnderlayControlModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		layerId: ''
	}
});

//view for underlay control
var UnderlayControlView = OverlayControlView.extend({
	el: '.underlay-control-container',
	events: {
		'click input': 'overlay'
	},
	template: _.template( $('#underlay-control-template').html() )
});

//model for filter interaction
var FilterModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		attributes: [],
		tool: "slider",
		features: {}
	}
});

//slider view for filter interaction
var FilterSliderView = Backbone.View.extend({
	el: ".filter-control-container",
	events: {
		"change select": "select"
	},
	template: _.template( $( '#slider-template').html() ),
	applyFilter: function(){},
	select: function(e){
		var select = $(e.target);
		this.setSlider(select.val(), select.attr('name'));
	},
	setSlider: function(attribute, layerName){
		//get attribute values for all features with given attribute
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
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
		var labelsDiv = this.$el.find("#"+layerName+"-labels");
		labelsDiv.children(".left").html(min);
		labelsDiv.children(".right").html(max);
		//to pass to slide callback
		var applyFilter = this.applyFilter;
		//call once to reset layer
		applyFilter(attribute, [min, max]);
		//set slider
		this.$el.find("#"+layerName+"-slider").slider({
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
	append: function(numericAttributes){
		//add line for data layer
		this.$el.append(this.template(this.model.attributes));
		//add slider for first attribute
		this.setSlider(numericAttributes[0], this.model.get('layerName'));
	},
	render: function(){
		//get all numeric attributes for data layer
		var numericAttributes = _.filter(this.model.get('attributes'), function(attribute){
			var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
			if (allAttributeValues.length > 0){
				return attribute;
			};
		}, this);
		//only proceed if there are one or more numeric attributes
		if (numericAttributes.length > 0){ this.append(numericAttributes); };
		//add dropdown option for each attribute
		var optionTemplate = _.template($('#filter-options-template').html()),
			select = this.$el.find('select[name=' + this.model.get('layerName') + ']');
		_.each(numericAttributes, function(attribute){
			select.append(optionTemplate({attribute: attribute}))
		}, this);
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
		//identify layer and attribute
		var layerDiv = $(e.target).parent();
		var attribute = layerDiv.children('select').val();
		//get attribute values min and max
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		var minmax = [_.min(allAttributeValues), _.max(allAttributeValues)];
		//array to hold filter values
		var values = [
			layerDiv.children('input[name=value1]').val(),
			layerDiv.children('input[name=value2]').val(),
		];
		//test whether input contains a value; if not, use default
		values = _.map(values, function(value, i){
			return value.length > 0 ? parseFloat(value) : minmax[i];
		});
		//go!
		this.applyFilter(attribute, values);
	},
	setValues: function(attribute, layerName){
		//get attribute values for all features with given attribute
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		//set values for inputs
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues);
		var parentDiv = this.$el.find('select[name='+layerName+']').parent();
		parentDiv.children('input[name=value1]').attr('placeholder', min);
		parentDiv.children('input[name=value2]').attr('placeholder', max);
	},
	append: function(numericAttributes){
		this.$el.append(this.template(this.model.attributes));
		this.setValues(numericAttributes[0], this.model.get('layerName'));
	},
	select: function(e){
		var select = $(e.target);
		this.setValues(select.val(), select.attr('name'));
	}
});

var ReexpressModel = Backbone.Model.extend({
	defaults: {
		iconName: '',
		layerName: '',
		className: ''
	}
});

//view for reexpress buttons
var ReexpressView = Backbone.View.extend({
	events: {
		"click": "setTechnique"
	},
	setTechnique: function(e){},
	render: function(){
		var html = '<button type="button" name="'+ this.model.get('layerName').replace(/\s|\:/g, '-') +'" class="'+ this.model.get('className') +'"><img class="icon" src="img/icons/'+ this.model.get('iconName') +'.png">'+ this.model.get('iconName').replace(/_|\:/g, ' ') +'</button>';
		this.$el.html(html);
		return html;
	}
});


/************** map.library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	initialize: function(){

	},
	events: {
		'click .reexpress': 'reexpress'
	},
	offLayers: {},
	render: function(){
		this.$el.html("<div id='map'>");
		return this;
	},
	addLayer: function(layerId){
		this.offLayers[layerId].addTo(this.map);
		delete this.offLayers[layerId];
	},
	removeLayer: function(layerId){
		this.offLayers[layerId] = this.map._layers[layerId];
		this.map.removeLayer(this.map._layers[layerId]);
	},
	setBaseLayer: function(baseLayer, i){
		//create leaflet tile layer
		var leafletBaseLayer = L.tileLayer(baseLayer.source, baseLayer.layerOptions);
		leafletBaseLayer.layerName = baseLayer.name;
		//need to pre-assign layerId for tile layers...for unknown reason
		leafletBaseLayer._leaflet_id = Math.round(Math.random()*10000);
		var layerId = leafletBaseLayer._leaflet_id;
		//only add first base layer to the map
		if (i==0){ 
			leafletBaseLayer.addTo(this.map);
		} else {
			this.offLayers[layerId] = leafletBaseLayer;
		};
		//add to array of base layers
		this.model.attributes.leafletBaseLayers.push(leafletBaseLayer);
		//add to underlay control
		var view = this,
			map = this.map;
		var underlayControlModel = new UnderlayControlModel({
			layerName: baseLayer.name,
			layerId: layerId,
		});
		var underlayControlView = new UnderlayControlView({model: underlayControlModel});
		//toggleLayer function must be defined for leaflet view
		underlayControlView.toggleLayer = function(layerId, addLayer){
			//turn clicked layer on
			if (!map._layers[layerId] && view.offLayers[layerId]){
				view.addLayer(layerId);
			};
			//turn other layers off
			$('.underlay-control-layer').each(function(){
				var thisId = $(this).attr('id').split('-')[2];
				if (layerId != thisId && map._layers[thisId]){
					view.removeLayer(thisId);
				};
			});
		};
		underlayControlView.render();
		//check the layer that is on the map
		if (this.map._layers[layerId]){
			$('#underlay-layer-'+layerId+' input').prop('checked', true);
		};
		//trigger done event
		if (i == this.model.get('baseLayers').length-1){ this.trigger('baseLayersDone') };
	},
	polygonToPoint: function(feature){
		var leafletFeature = L.geoJson(feature);
		var center = leafletFeature.getBounds().getCenter();
		feature.geometry.type = 'Point';
		feature.geometry.coordinates = [center.lng, center.lat];
		return feature;
	},
	setDataLayer: function(dataLayer, i){
		//global object to hold non-mapped layers
		if (!window.offLayers){ window.offLayers = {}; };
		//get layer options
		var dataLayerOptions = dataLayer.layerOptions;
		//create a layer for each technique
		_.each(dataLayer.techniques, function(technique, a){
			//get model based on technique type
			var dataLayerModel = new techniquesObj[technique.type];
			//pass in necessary values
			dataLayerModel.set({
				classificationType: technique.classification,
				expressedAttribute: dataLayer.expressedAttribute,
				classes: technique.classes,
				dataLayer: dataLayer
			});
			//set up AJAX callback
			dataLayerModel.once('done', function(){
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
						if (dataLayer.displayAttributes){
							dataLayer.displayAttributes.forEach(function(attr){
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
							//only trigger event if popup is visible
							if ($('.leaflet-popup-pane').css('display') != 'none'){
								view.trigger('popupopen');
							};
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
					//turn any non-point features into point features
					var newFeatures = _.map(dataLayerModel.get('features'), function(feature){
						if (feature.geometry.type != 'Point'){
							return this.polygonToPoint(feature);
						} else {
							return feature;
						};
					}, this);
					dataLayerModel.set('features', newFeatures);
					//add pointToLayer to create prop symbols
					overlayOptions.pointToLayer = pointToLayer;
				};
				var leafletDataLayer = L.geoJson(dataLayerModel.get('features'), overlayOptions);
				leafletDataLayer.model = dataLayerModel;
				leafletDataLayer.layerName = layerName;
				leafletDataLayer.techniqueType = technique.type;
				var layerId = leafletDataLayer._leaflet_id;
				//render immediately by default
				if (a==0 && (typeof dataLayer.renderOnLoad === 'undefined' || dataLayer.renderOnLoad == 'true')){
					//add layer to map
					leafletDataLayer.addTo(this.map);
				} else {
					//stick it in offLayers array
					this.offLayers[layerId] = leafletDataLayer;
				};
				//add to layers
				model.attributes.leafletDataLayers.push(leafletDataLayer);
				//add to overlay control
				if ($('.overlay-control-container')){
					var map = this.map,
						offLayers = this.offLayers;
					var overlayControlModel = new OverlayControlModel({
						layerName: layerName,
						layerId: layerId,
						techniqueType: technique.type
					});
					var overlayControlView = new OverlayControlView({model: overlayControlModel});
					//toggleLayer function must be defined for leaflet view
					overlayControlView.toggleLayer = function(layerId, addLayer){
						//turn layer on/off
						if (map._layers[layerId] && !addLayer){
							view.removeLayer(layerId);
						} else if (!map._layers[layerId] && offLayers[layerId]){
							view.addLayer(layerId);
						};
					};
					overlayControlView.render();
					//only show the layers that are on the map
					if (this.offLayers[layerId]){
						$('#overlay-layer-'+layerId).hide();
					} else {
						$('#overlay-layer-'+layerId+' input').prop('checked', true);
					};
				};
				//if the last layer, trigger the done event
				if (i == model.get('dataLayers').length-1 && a == dataLayer.techniques.length-1){ 
					this.trigger('dataLayersDone');
				};
			}, this);
			//go get the data!
			dataLayerModel.fetch({url: dataLayer.source});
		}, this);
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
	hideLabels: function(){
		//if overlay is absent, hide all checkboxes
		if (!this.model.get('interactions.overlay')){
			$('.leaflet-control-layers-overlays input').hide();
		};
		//temporarily hide all labels with reexpress buttons
		$('.reexpress').parents('label').hide();
		//hide unchecked labels with buttons--kinda hacky, but can't figure out another way
		$('.leaflet-control-layers-overlays label').each(function(){
			var label = $(this);
			var reexpressSpan = label.find('.reexpress');
			var button = $(this).find('button');
			var input = $(this).find('input');
			input.off();
			//inactivate both buttons if layer is unchecked
			input.on('change', function(){
				if (button.length > 0){
					if ($(this).prop('checked')){
						label.find('button[class="inactive now"]').attr('class', 'active');
					} else {
						label.find('button[class=active]').attr('class', 'inactive now');
						button.click(function(e){ e.preventDefault() });
					};
				};
			});
			if (reexpressSpan.length > 0){
				//if the label's checkbox is checked, set to visible
				if (input.prop('checked')){
					var dataLayerName = button.attr('name');
					//find all labels for same dataLayer and reset classes
					$('.leaflet-control-layers-overlays').find('button[name="'+ dataLayerName +'"]').parents('.reexpress').attr('class', 'reexpress');
					//set only buttons belonging to checked layer to visible
					reexpressSpan.attr('class', 'reexpress visible');
				};
			};
		});
		//show only one label for each dataLayer, even if renderOnLoad is false
		$('.visible').parents('label').show();
	},
	CustomControl: function(controlName, position){
		var model = this.model;
		var map = this.map;
		//extend Leaflet controls to create control
		var Control = L.Control.extend({
			options: {
				position: position
			},
			onAdd: function(map){
				//create container for control
				var container = L.DomUtil.create('div', controlName+'-control-container control-container');
				//add name and icon if not the interaction buttons
				if (controlName != 'interaction'){
					container.innerHTML = '<img class="icon" src="img/icons/'+controlName+'.png" alt="'+controlName+'" title="'+controlName+'"><span class="control-title">'+controlName+'</span>';
					$(container).hide();
				};
				//kill map interactions under control
				L.DomEvent.addListener(container, 'mousedown click dblclick', function(e) {
					L.DomEvent.stopPropagation(e);
				});
				return container;
			}
		});
		return Control;
	},
	pan: function(e){
		switch (e){
			case 'pan-up':
				this.map.panBy([0, -80]); break;
			case 'pan-left':
				this.map.panBy([-80, 0]); break;
			case 'pan-right':
				this.map.panBy([80, 0]); break;
			case 'pan-down':
				this.map.panBy([0, 80]); break;
		};
	},
	layerChange: function(e){
		//edit legend
		var legendEntry = $('#legend-'+e.layer._leaflet_id);
		legendEntry.length > 0 && e.type == 'layeradd' ? legendEntry.show() : legendEntry.hide();
	},
	addLegend: function(){
		var model = this.model,
			map = this.map;
		//add legend control
		var CustomControl = this.CustomControl('legend', 'bottomright');
		this.legendControl = new CustomControl();
		//need to actually create SVGs in onAdd() function to work correctly
		this.legendControl.onAdd = function(map){
			//create container for control
			var container = L.DomUtil.create('div', 'legend-control-container control-container');
			var innerHTML = '<img class="icon button" src="img/icons/legend.png" alt="legend" title="click to open legend"><div id="legend-wrapper"><h3>Legend</h3>';
			//add legend entry for each visible data layer
			_.each(model.get('leafletDataLayers'), function(layer, i){
				var id = 'legend-'+layer._leaflet_id;
				//only show immediately if layer is visible
				var display = map.hasLayer(layer) ? 'block' : 'none';
				innerHTML += '<div id="'+id+'" style="display: '+display+';"><p class="legend-layer-title">'+layer.layerName+' '+layer.techniqueType+'<br/>Attribute: '+layer.model.get('expressedAttribute')+'</p>';
				var legendView = new LegendLayerView({model: layer.model});
				innerHTML += legendView.$el[0].outerHTML + '</div>';
			}, this);
			innerHTML += '</div>';
			container.innerHTML = innerHTML;

			//kill map interactions under control
			L.DomEvent.addListener(container, 'mousedown click dblclick', function(e) {
				L.DomEvent.stopPropagation(e);
			});
			return container;
		};
		//add legend to the map
		this.map.addControl(this.legendControl);
		//add close button
		var closeButton = _.template( $('#close-button-template').html() );
		$('.legend-control-container').append(closeButton({x: $('.legend-control-container').width() - 20 + "px"}));
		//add open and close listeners
		$('.legend-control-container .icon').click(function(){
			$('.legend-control-container .icon').hide();
			$('#legend-wrapper, .legend-control-container .close').show();
		});
		$('.legend-control-container .close').click(function(){
			$('#legend-wrapper, .legend-control-container .close').hide();
			$('.legend-control-container .icon').show();
		});
		//hide everything but icon to start
		$('#legend-wrapper').hide();
	},
	addOverlayControl: function(){
		//add layer control if it wasn't created for underlay
		if (!this.layerControl){
			this.layerControl = L.control.layers({position: 'bottomright'}).addTo(this.map);
		};
		//add each overlay to layers control
		_.each(this.model.get('leafletDataLayers'), function(overlay){
			//only add listed layers or multiple techniques of dataLayers if reexpress interaction
			if (_.indexOf(this.model.get('interactions.overlay.dataLayers'), overlay.layerName) > -1 || (this.model.get('interactions.reexpress') && _.findWhere(this.model.get('dataLayers'), {name: overlay.layerName}).techniques.length > 1)){
				//for reexpress interaction, replace overlay.layerName with html for span placeholders
				if (this.model.get('interactions.reexpress')){
					var layerName = this.addReexpress(overlay.layerName, overlay.techniqueType);
					this.layerControl.addOverlay(overlay, layerName);
				} else {
					this.layerControl.addOverlay(overlay, overlay.layerName);
				};
			};
		}, this);
		//do stuff on overlay change
		var view = this;
		this.map.on('overlayadd overlayremove', function(e){
			//set custom interaction for logging
			if (!view.reexpressed){ view.trigger('overlay'); };
			var layerName = e.name.indexOf(': <') > -1 ? e.name.split(': <')[0] : e.name;
			layerName = layerName.replace(/\s|\:/g, '-');
			if (e.type == 'overlayadd'){
				//enable filtering
				$('#'+layerName+'-slider').slider('enable');
				$('#'+layerName+'-logic-div input').removeProp('disabled');
			} else {
				//reset and disable filter sliders
				var sliderOptions = $('#'+layerName+'-slider').slider('option');
				$('#'+layerName+'-slider').slider('values', [sliderOptions.min, sliderOptions.max]);
				$('#'+layerName+'-labels .left').text(sliderOptions.min);
				$('#'+layerName+'-labels .right').text(sliderOptions.max);
				$('#'+layerName+'-slider').slider('disable');
				//reset and disable logic sliders
				$('#'+layerName+'-logic-div input').val('');
				$('#'+layerName+'-logic-div input').prop('disabled', true);
			}
		});
		this.hideLabels();
	},
	addUnderlayControl: function(){
		//add layer control if it wasn't created for overlay
		if (!this.layerControl){
			this.layerControl = L.control.layers(null, null, {position: 'bottomright'}).addTo(this.map);
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
		var map = this.map,
			offLayers = this.offLayers;
		//add control to map
		var CustomControl = this.CustomControl('filter', 'bottomleft');
		this.filterControl = new CustomControl();
		map.addControl(this.filterControl);

		//applyFilter function references map, so must be created here
		var applyFilter = function(attribute, values){
			//helpful abbreviations
			var min = values[0], max = values[1];
			//remove layers outside of filter range
			map.eachLayer(function(layer){
				if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
					var layerValue = layer.feature.properties[attribute];
					//if value falls outside range, remove from map and stick in removed layers array
					if (layerValue < min || layerValue > max){
						map.removeLayer(layer);
						offLayers[layer._leaflet_id] = layer;
					};
				};
			});
			//add layers within filter range
			_.each(offLayers, function(layer){
				if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
					var layerValue = layer.feature.properties[attribute];
					//if value within range, add to map and remove from removed layers array
					if (layerValue > min && layerValue < max){
						layer.addTo(map);
						delete offLayers[layer._leaflet_id];
					};
				};
			});
		};
		//get interaction variables
		var filterLayers = this.model.get('interactions.filter.dataLayers'),
			controlType = this.model.get('interactions.filter.tool');
		//set a tool for each included data layer
		_.each(this.model.get('dataLayers'), function(dataLayer){
			//test for inclusion of data layer in filter interaction
			if (_.indexOf(filterLayers, dataLayer.name) > -1){
				//get filter properties
				var attributes = dataLayer.displayAttributes;
				//set a filter tool
				var filterModel = new FilterModel({layerName: dataLayer.name.replace(/\s|\:/g, '-'), attributes: attributes, tool: controlType, map: this.map, features: this.getFeatures()});
				//filter view options
				var filterViewOptions = {
					model: filterModel, 
					applyFilter: applyFilter
				};
				//create filter view
				var filterView = controlType == 'logic' ? new FilterLogicView(filterViewOptions) : new FilterSliderView(filterViewOptions);
				filterView.render();
			};
			
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
	addReexpress: function(layerName, techniqueType){
		//function to render buttons
		var techniques = _.findWhere(this.model.get('dataLayers'), {name: layerName}).techniques;
		//if multiple available techniques, add button for each
		if (techniques.length > 1){
			var layerNameHtml = layerName +': ';
			var spanClass = 'reexpress';
			_.each(techniques, function(technique, i){
				var state = technique.type == techniqueType ? 'active' : 'inactive';
				spanClass += i == 0 && technique.type == techniqueType ? ' visible' : '';
				//ReexpressView can be used to create buttons or button html
				var reexpressButton = new ReexpressView({
					model: new ReexpressModel({
						iconName: technique.type.replace(/\s|\:/g, '_'),
						layerName: layerName,
						className: state
					})
				});
				//here we use it to just create html
				layerNameHtml += '<span class="'+spanClass+'">'+ reexpressButton.render() +'</span>'; 
			}, this);
			//add reexpress buttons to layers control
			return layerNameHtml;
		} else {
			//no buttons
			return layerName;
		};
	},
	reexpress: function(e){
		var view = this,
			map = view.map,
			offLayers = view.offLayers
			button = $(e.target),
			span = button.parent(),
			spanParent = span.parent(),
			dataLayerName = button.attr('name'),
			techniqueType = button.children('img').attr('src').split('/')[2];
			techniqueType = techniqueType.substring(0, techniqueType.indexOf('.')).replace(/_|\:/g, ' ');
		//set variable to prevent overlay interaction from triggering
		view.reexpressed = true;
		setTimeout(function(){ view.reexpressed = false; }, 500);
		//trigger reexpress interaction
		view.trigger('reexpress');
		//check each layer on the map for a name match
		map.eachLayer(function(layer){
			if (layer.layerName && layer.layerName.replace(/\s|\:/g, '-') == dataLayerName){
				//remove the layer from the map to replace with other technique
				map.removeLayer(layer);
				offLayers[layer._leaflet_id] = layer;
				//if a layer with the correct technique exists, put it on the map
				_.each(offLayers, function(offLayer){
					if (offLayer.layerName == layer.layerName && offLayer.techniqueType == techniqueType){
						offLayer.addTo(map);
						delete offLayers[offLayer._leaflet_id];
						return false;
					};
					//remove single-feature layers that might be leftover from filter
					if (offLayer.feature){
						delete offLayers[offLayer._leaflet_id];
					};
				}, this);
			};
		});
		//switch labels in layers control
		this.hideLabels();
	},
	addResymbolize: function(){
		//change classification scheme, class breaks, and output values via legend



	},
	setMapInteractions: {
		zoom: function(controlView, leafletView){
			var map = leafletView.map;
			//set on/off scripts
			controlView.addInteraction = function(){
				map.touchZoom.enable();
				map.scrollWheelZoom.enable();
				map.doubleClickZoom.enable();
				map.boxZoom.enable();
				map.keyboard._setZoomOffset(1);
			};
			controlView.removeInteraction = function(){
				map.touchZoom.disable();
				map.scrollWheelZoom.disable();
				map.doubleClickZoom.disable();
				map.boxZoom.disable();
				map.keyboard._setZoomOffset(0);
			};
			//add zoom control to map
			L.control.zoom({position: 'bottomleft'}).addTo(map);
			//add zoom-control-container class and hide
			var zoomControl = $('.leaflet-control-zoom');
			zoomControl.attr('class', zoomControl.attr('class') + ' zoom-control-container');
			zoomControl.hide();
			//set message for first click alert
			controlView.message = 'In addition to the zoom tool, you can use a mouse scroll wheel, double-click, shift-click-drag, or the + and - keys to zoom on a desktop computer, and pinch to zoom on a touch-enabled device.';
			return controlView;
		},
		pan: function(controlView, leafletView){
			var map = leafletView.map;
			//on/off scripts
			controlView.addInteraction = function(){
				map.dragging.enable();
				map.keyboard._setPanOffset(80);
			};
			controlView.removeInteraction = function(){
				map.dragging.disable();
				map.keyboard._setPanOffset(0);
			};
			//add pan control to map and hide
			var PanControl = leafletView.CustomControl('pan', 'bottomleft');
			var panControl = new PanControl();
			map.addControl(panControl);
			var panControlView = new PanControlView();
			$('.pan-control-container').hide();
			//set pan control events
			panControlView.on('pan', leafletView.pan, leafletView);
			//set message for first click alert
			controlView.message = 'In addition to the pan tool, you can click and drag the map or use the arrow keys to pan the map on a desktop computer, or touch and drag with one finger to pan the map on a touch-enabled device.';
			return controlView;
		},
		retrieve: function(controlView, leafletView){
			var map = leafletView.map;
			//on/off scripts
			controlView.addInteraction = function(){
				//close any hidden-but-open popups
				map.closePopup();
				$('.leaflet-popup-pane').show();
				$('.leaflet-interactive').removeAttr('style');
			};
			controlView.removeInteraction = function(){
				$('.leaflet-popup-pane').hide();
				$('.leaflet-interactive').css('cursor', 'default');
			};
			//add retrieve-control-container class to allow popup pane show/hide
			var popupPane = $('.leaflet-popup-pane');
			popupPane.attr('class', popupPane.attr('class') + ' retrieve-control-container');
			//set message for first click alert
			controlView.message = 'Retrieve information by clicking a map feature to open a pop-up on the feature.';
			return controlView;
		},
		overlay: function(controlView, leafletView){
			var map = leafletView.map;
			//add overlay control
			var OverlayControl = leafletView.CustomControl('overlay', 'bottomleft');
			var overlayControl = new OverlayControl();
			map.addControl(overlayControl);
			return controlView;
		},
		underlay: function(controlView, leafletView){
			var map = leafletView.map;
			//add overlay control
			var UnderlayControl = leafletView.CustomControl('underlay', 'bottomleft');
			var underlayControl = new UnderlayControl();
			map.addControl(underlayControl);
			return controlView;
		},
		search: function(controlView, leafletView){
			return controlView;
		},
		filter: function(controlView, leafletView){
			return controlView;
		},
		reexpress: function(controlView, leafletView){
			return controlView;
		},
		resymbolize: function(controlView, leafletView){
			return controlView;
		},
		reproject: function(controlView, leafletView){
			return controlView;
		}
	},
	setInteractionControls: function(){
		//set no-interaction map option defaults
		var noInteraction = {
			zoomControl: false,
			touchZoom: false,
			scrollWheelZoom: false,
			doubleClickZoom: false,
			boxZoom: false,
			dragging: false,
			keyboardPanOffset: 0,
			keyboardZoomOffset: 0
		};
		var mapOptions = this.model.get('mapOptions');
		this.model.set('mapOptions', _.extend(mapOptions, noInteraction));
		//once map has been set, add interaction UI controls
		this.on('mapset', function(){
			var map = this.map;
			//set interaction toggle buttons control
			var InteractionControl = this.CustomControl('interaction', 'topright');
			var interactionControl = new InteractionControl();
			interactionControl.addTo(map);
			//create new button for each interaction
			for (var interaction in this.model.get('interactions')){
				//instantiate model
				var interactionControlModel = new InteractionControlModel({interaction: interaction});
				//instantiate view
				var interactionToggleView = new InteractionToggleView({model: interactionControlModel});
				//add controls and scripts for each included interaction
				if (this.setMapInteractions[interaction]){
					interactionToggleView = this.setMapInteractions[interaction](interactionToggleView, this);
				};
				//render interaction toggle button
				interactionToggleView.render();
			};
			console.log(map);
		}, this);

		//set legend control
		if (typeof this.model.get('mapOptions.legend') == 'undefined' || this.model.get('mapOptions.legend')){
			this.on('dataLayersDone', this.addLegend, this);
		};

		//set layers control for overlay and reexpress interactions
		if ((this.model.get('interactions.overlay') && this.model.get('interactions.overlay.dataLayers') && this.model.get('interactions.overlay.dataLayers').length > 0) || (this.model.get('interactions.reexpress') && _.some(this.model.get('dataLayers'), function(layer){
			return layer.techniques.length > 1
		}))){
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
		if (this.model.get('interactions.filter') && this.model.get('interactions.filter.dataLayers') && this.model.get('interactions.filter.dataLayers').length > 0){
			this.on('dataLayersDone', this.addFilter, this);
		};
		//set resymbolize control for resymbolize interaction
		if (this.model.get('interactions.resymbolize')){
			this.on('dataLayersDone', this.addResymbolize, this);
		};


		this.on('dataLayersDone', function(){
			//prevent retrieve by default
			$('.leaflet-popup-pane').hide();
			$('.leaflet-interactive').css('cursor', 'default');
		}, this);
	},
	logInteractions: function(){
		//designate events to listen to with contexts for each interaction
		var interactionCreation = {
			zoom: {zoomstart: this.map},
			pan: {dragend: this.map},
			retrieve: {popupopen: this},
			overlay: {overlay: this},
			underlay: {baselayerchange: this.map},
			search: {search: this},
			filter: {filter: this},
			reexpress: {reexpress: this}
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
		this.setInteractionControls();
		//create Leaflet layers arrays
		this.model.set({
			leafletBaseLayers: [],
			leafletDataLayers: []
		});

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//trigger mapset event
		this.trigger('mapset');

		//set layer change listener
		var layerChange = this.layerChange;
		this.map.on('layeradd layerremove', layerChange);

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
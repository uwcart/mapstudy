//Map panel

(function(){

/************************ helper functions ***************************/

//produce numeric values array from GeoJSON features
function getAllAttributeValues(features, attribute){
	//get attribute values for all features with given attribute
	var values = []
	_.each(features, function(feature){
		var value = parseFloat(feature.properties[attribute]);
		if (!isNaN(value) && value != null){
			values.push(value);
		};
	});
	values.sort(function(a,b){ return a-b });
	return values;
};

function polygonToPoint(feature){
	//get polygon centroid
	var point = turf.centroid(feature);
	//transfer other feature properties
	for (var key in feature){
		if (key != 'geometry'){
			point[key] = feature[key];
		};
	};
	return point;
};

/*************************** map.dataLayer ***************************/

//basic model to hold geojson and data layer options
var DataLayerModel = Backbone.Model.extend();

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

var UserDefined = Backbone.Model.extend({
	defaults: {
		type: 'user defined'
	},
	scale: function(domain, classes){
		//create scale generator
		var scale = d3.scale.threshold()
			.range(classes)
			.domain(domain);
		//done
		return scale;
	}
});

//a single collection holds all classification models
var classification = new Backbone.Collection([
	new Quantile(),
	new EqualInterval(),
	new NaturalBreaks(),
	new Unclassed(),
	new UserDefined()
]);

/************** map.dataLayer.technique ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend({
	defaults: {
		techniqueIndex: 0,
		techniqueType: 'choropleth'
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//weed out NaN and null values
		var value = parseFloat(feature.properties[expressedAttribute]);
		if (!isNaN(value) && value != null){
			//set a new fillColor property for each feature with the class color value
			return {
				fillColor: scale(value),
				fill: scale(value)
			};
		} else {
			//set opacity to 0 for null or non-numeric values
			return {
				fillOpacity: 0,
				'fill-opacity': 0
			};
		};
	},
	symbolize: function(){
		var expressedAttribute = this.get('expressedAttribute'),
			techniqueIndex = this.get('techniqueIndex'),
			technique = this.get('techniques')[techniqueIndex];
		//retrieve ColorBrewer scheme if classes is a colorbrewer code
		var classes;
		if (typeof technique.classes == 'string'){
			var colorcode = technique.classes.split('.');
			classes = colorbrewer[colorcode[0]][Number(colorcode[1])];
		} else {
			classes = technique.classes;
		};
		//get all of the values for the attribute by which the data will be classed
		var values = getAllAttributeValues(this.get('features'), expressedAttribute);
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: technique.classification})[0];
		var scale = classificationModel.scale(values, classes);
		//use scale and attribute to set layer options
		_.each(this.get('features'), function(feature){
			feature.properties.layerOptions = this.setLayerOptions(feature, scale, expressedAttribute);
		}, this);
		this.set('scale', scale);
	}
});

//model for proportional symbol data overlay
var ProportionalSymbol = Choropleth.extend({
	defaults: {
		symbol: 'circle',
		techniqueType: 'proportional symbol'
	},
	polygonsToPoints: function(rawfeatures, expressedAttribute){
		var features = [];
		//transform polygon features into point features
		_.each(rawfeatures, function(rawfeature){
			//filter out features with null and non-numeric values
			if (rawfeature.properties[expressedAttribute] != null && !isNaN(Number(rawfeature.properties[expressedAttribute]))){
				if (rawfeature.geometry.type == 'Polygon' || rawfeature.geometry.type == 'MultiPolygon') {
					features.push(polygonToPoint(rawfeature));
				} else {
					features.push(rawfeature);
				};
			};
		});
		return features;
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//turn any polygons into points
		this.set('features', this.polygonsToPoints(this.get('features'), expressedAttribute));
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

var Isarithmic = ProportionalSymbol.extend({
	defaults: {
		interval: 1,
		techniqueType: 'isarithmic'
	},
	setIsarithms: function(interval){
		var size = this.get('size'),
			features = this.get('pointFeatures'),
			expressedAttribute = this.get('expressedAttribute'),
			values = getAllAttributeValues(features, expressedAttribute),
			breaks = [];
		//set interval
		this.set('interval', interval);
		//set breaks as set of interval multiples in attribute value domain
		for (var i = 0; i < values[values.length-1]; i += interval){
			if (i >= values[0]){
				breaks.push(i);
			};
		};
		//put features in FeatureCollection object for turf
		var featureCollection = {
			type: "FeatureCollection",
			features: features
		};
		//return isarithms
		var resolution = Math.round(Math.sqrt(features.length)*2);
		var isarithms = turf.isolines(featureCollection, expressedAttribute, resolution, breaks);
		//add an object for layer options
		_.each(isarithms.features, function(feature){
			feature.properties.layerOptions = {};
			//if size is included, set as layer option
			if (size != null && !isNaN(size)){
				feature.properties.layerOptions['stroke-width'] = size;
				//leaflet pseudo-css
				feature.properties.layerOptions.weight = size;
			};
		});
		this.set('features', isarithms.features);

	},
	symbolize: function(){
		//get all of the attribute values to set breaks
		var expressedAttribute = this.get('expressedAttribute'),
			technique = this.get('techniques')[this.get('techniqueIndex')],
			interval = technique.interval || 10;
		//set point feature set to enable resymbolize
		this.set({
			pointFeatures: this.polygonsToPoints(this.get('features'), expressedAttribute),
			size: technique.size || null
		});
		//the rest should be reusable to enable resymbolize
		this.setIsarithms(interval);
	}
});

var Heat = Isarithmic.extend({
	defaults: {
		techniqueType: 'heat'
	},
	featuresToDataPoints: function(features, expressedAttribute){
		//return data usable to leaflet-heatmap
		var data = [];
		_.each(features, function(feature){
			var datum = {
				lat: feature.geometry.coordinates[1],
				lng: feature.geometry.coordinates[0]
			};
			datum[expressedAttribute] = feature.properties[expressedAttribute];
			data.push(datum);
		});
		return data;
	},
	setHeatmap: function(model){
		//library specific
	},
	symbolize: function(){
		var technique = this.get('techniques')[this.get('techniqueIndex')],
			size = technique.size ? technique.size: null;
		this.set('size', size);
		this.setHeatmap(this);
	}
});

//an object references technique classes to their types
var techniquesObj = {
	'choropleth': Choropleth,
	'proportional symbol': ProportionalSymbol,
	'isarithmic': Isarithmic,
	'heat': Heat
};

//view for legend creation
var LegendLayerView = Backbone.View.extend({
	tagName: 'svg',
	id: function(){
		return this.model.get('className') + '-' + this.model.get('techniqueType').replace(/\s/g, '-') + '-legend';
	},
	append: function(range, domain, i){
		var techniqueType = this.model.get('techniqueType');
		template = _.template( $('#'+techniqueType.replace(/\s/g, '-')+'-legend-template').html() );
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
	setSvgDims: function(){
		//set svg dimensions
		this.$el.attr({
			width: this.model.get('svgWidth'),
			height: this.model.get('svgHeight'),
			xmlns: 'http://www.w3.org/2000/svg',
			version: '1.1'
		});
	},
	initialize: function(){
		//set styles according to layer options
		var css = {},
			layerOptions = this.model.get('layerOptions');
		//deal with special Leaflet options
		var leafletOptionsKey = {
			fillColor: 'fill',
			fillOpacity: 'fill-opacity',
			color: 'stroke',
			weight: 'stroke-width',
			opacity: 'stroke-opacity',
			dashArray: 'stroke-dasharray',
			linecap: 'stroke-linecap',
			linejoin: 'stroke-linejoin'
		};
		//add layer options to css object
		for (var option in layerOptions){
			//add real CSS keys in place of fake Leaflet ones
			if (leafletOptionsKey.hasOwnProperty(option) && !css.hasOwnProperty(leafletOptionsKey[option])){
				css[leafletOptionsKey[option]] = layerOptions[option];
			};
			css[option] = layerOptions[option];
		};
		//set legend elements
		var techniqueType = this.model.get('techniqueType');
		//only use scale for choropleth and prop symbol layers
		if (techniqueType == 'choropleth' || techniqueType == 'proportional symbol'){
			//get output range and input domain values
			var scale = this.model.get('scale'),
				range = scale.range(),
				domain = scale.domain();
			//get expressed attribute
			var expressedAttribute = this.model.get('expressedAttribute');
			//calculate svg height
			if (!isNaN(parseFloat(range[range.length-1]))){ //if range is a number, treat as prop symbol
				//set max radius
				this.model.set('maxRadius', parseFloat(range[range.length-1]));
				//svg height should be whichever is larger, label heights or largest circle diameter
				var heightArray = [
					13 * range.length + 6, 
					parseFloat(range[range.length-1]) * 2 + 6
				];
				heightArray.sort(function(a,b){ return b-a });
				this.model.set('svgHeight', heightArray[0]);
			} else {
				this.model.set('svgHeight', 13 * range.length + 6);
			};
			//only build classes for classed classification
			var y = 0;
			if (domain.length > 2 || range.length > 2){
				//add a symbol for each class
				for (var i = range.length-1; i >= 0; i--){
					var domainvals = scale.invertExtent(range[i]);
					//fill in min and max values for natural breaks threshold scale
					if (typeof domainvals[0] == 'undefined'){
						domainvals[0] = d3.min(getAllAttributeValues(this.model.get('features'), expressedAttribute));
					} else if (typeof domainvals[1] == 'undefined'){
						domainvals[1] = d3.max(getAllAttributeValues(this.model.get('features'), expressedAttribute));
					};
					//add visual element and label for each class
					this.append(range[i], domainvals, y);
					//count up to put swatches in correct order
					y++;
				};
			} else {
				//add a symbol for lowest and highest values
				for (var i = range.length-1; i >= 0; i--){
					this.append(range[i], domain[i], y);
					y++;
				};
			};
			//set svg dimensions
			this.setSvgDims();
		} else if (techniqueType == 'isarithmic'){
			//get interval and size
			var interval = this.model.get('interval'),
				size = this.model.get('size');
			//override stroke width with size if present
			if (size != null && !isNaN(size)){
				css['stroke-width'] = size;
			};
			//set legend line
			this.append(css.stroke, 'Line interval: '+interval, 0);
			//set stroke width
			if (css.hasOwnProperty('stroke-width')){
				this.$el.find('path').attr('stroke-width', css['stroke-width']);
			};
			//set svg height
			this.model.set('svgHeight', 16);
			//set svg dimensions
			this.setSvgDims();
		} else if (techniqueType == 'heat'){
			//get size and domain
			var size = this.model.get('size'),
				allValues = getAllAttributeValues(this.model.get('features'), this.model.get('expressedAttribute')),
				min = allValues[0],
				max = allValues[allValues.length-1],
				domain = [min, max];
			//set default size
			if (size == null || isNaN(size)){
				size = 1;
			};
			//add legend line
			this.append(size, domain, 0);
			//set svg height
			this.model.set('svgHeight', 20);
			//set svg dimensions
			this.setSvgDims();
			//wrap in a heat-mappable div
			var wrapper = $('<div class="heatmap-legend-wrapper">');
			wrapper = this.$el.wrap(wrapper);
			this.$el = wrapper.parent();
			//add div for heatmap
			this.$el.prepend('<div class="heatmap-symbol">');
		};
		
		//style according to layer options
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
	addInteraction: function(){},
	removeInteraction: function(){},
	toggle: function(e, toggleView){
		//get target and interaction
		var target = $(e.target).attr('class') ? $(e.target) : $(e.target).parent(),
			className = target.attr('class'),
			interaction = className.split('-')[0];
		//toggle
		var action, state;
		if (className.indexOf(' active') > -1){
			action = 'inactivate', state = 'inactive';
			//close associated interaction widget
			$('.'+interaction+'-control-container').hide();
			//remove active class
			target.attr('class', className.substring(0, className.indexOf(' active')));
			//remove any additional interaction scripts
			toggleView.removeInteraction();
		} else {
			action = 'activate', state = 'active';
			//open associated interaction widget
			$('.'+interaction+'-control-container').show();
			//add active class
			target.attr('class', className + ' active');
			//add any additional interaction scripts
			toggleView.addInteraction();
		};
		//fire inactivate event
		toggleView.trigger('toggle', {
			action: action,
			state: state,
			interaction: interaction
		});
	},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
		var toggleView = this,
			toggle = this.toggle;
		this.$el.children('.'+this.model.get('interaction')+'-control').click(function(e){
			toggle(e, toggleView);
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
	panMap: function(targetId){},
	pan: function(e){
		var targetId = $(e.target).attr('id') ? $(e.target).attr('id') : $(e.target).parent().attr('id');
		this.panMap(targetId);
	}
});

//view for retrieve interaction
var RetrieveControlView = InteractionControlView.extend({
	el: '.retrieve-control-container',
	template: _.template( $('#popup-line-template').html() ),
	retrieve: function(attributes){
		$('.retrieve-attributes').html('Click a map feature');
		if (typeof attributes != 'undefined'){
			_.each(attributes, function(attribute){
				$('.retrieve-attributes').append(this.template({
					attribute: attribute.attribute,
					value: attribute.value
				}));
			}, this);
		};
	},
	initialize: function(){
		this.$el.append('<div class="retrieve-attributes">Click a map feature</div>');
		return this;
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
	template: _.template( $('#overlay-control-template').html() ),
	toggleLayer: function(layerId, addLayer){},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
		//set click interaction on this child element only
		var view = this;
		this.$el.find('.layer-'+this.model.get('layerId')+' input').click(function(e){
			view.toggleLayer($(e.target).val(), $(e.target).prop('checked'));
		});
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

//model for Fuse search of GeoJSON features
var SearchModel = Backbone.Model.extend({
	defaults: {
		allFeatures: {},
		searchOptions: {},
		fuse: {},
		term: '',
		result: []
	},
	createSearch: function(){
		this.set('fuse', new Fuse(this.get('allFeatures'), this.get('searchOptions')));
	},
	search: function(){
		this.set('result', this.get('fuse').search(this.get('term')));
	}
});

var SearchInputView = Backbone.View.extend({
	el: '.search-control-container',
	template: _.template($('#search-control-template').html()),
	events: {
		'click button': 'resetSearch'
	},
	resetSearch: function(){
		this.$el.find('input').val('');
		$('#search-results-box').empty();
		this.trigger('reset');
	},
	initialize: function(){
		this.$el.append(this.template());
	}
});

var SearchView = Backbone.View.extend({
	el: '.search-control-container',
	template: _.template($('#search-result-template').html()),
	events: {
		'keyup input': 'search'
	},
	selectFeature: function(e, result){},
	search: function(e){
		//define search term
		this.model.set('term', $(e.target).val());
		//get results
		this.model.search();
		//reset html
		this.$el.children('#search-results-box').empty();
		_.each(this.model.get('result'), function(result, i){
			//limit to top 10 results
			if (i < 10){
				var featureId = i + result.properties.name.replace(/[\.\s#]/g, '') + result.id;
				//append a new line for each result
				this.$el.children('#search-results-box').append(this.template({featureName: result.properties.name, featureId: featureId}));
				//attach click listener
				var selectFeature = this.selectFeature;
				$('#result-'+featureId).click(function(e){ selectFeature(e, result); });
			};
		}, this);
	}
});

//model for filter interaction
var FilterModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		className: '',
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
	setSlider: function(attribute, className){
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
		var labelsDiv = this.$el.find("#"+className+"-labels");
		labelsDiv.children(".left").html(min);
		labelsDiv.children(".right").html(max);
		//to pass to slide callback
		var applyFilter = this.applyFilter;
		//call once to reset layer
		applyFilter(attribute, [min, max], true);
		//set slider
		this.$el.find("#"+className+"-slider").slider({
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
		this.setSlider(numericAttributes[0], this.model.get('className'));
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
			select = this.$el.find('select[name=' + this.model.get('className') + ']');
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
	setValues: function(attribute, className){
		//get attribute values for all features with given attribute
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		//set values for inputs
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues);
		var parentDiv = this.$el.find('select[name='+className+']').parent();
		parentDiv.children('input[name=value1]').attr('placeholder', min);
		parentDiv.children('input[name=value2]').attr('placeholder', max);
	},
	append: function(numericAttributes){
		this.$el.append(this.template(this.model.attributes));
		this.setValues(numericAttributes[0], this.model.get('className'));
	},
	select: function(e){
		var select = $(e.target);
		this.setValues(select.val(), select.attr('name'));
	}
});

//model for reexpress widget
var ReexpressModel = Backbone.Model.extend({
	defaults: {
		layer: {},
		techniqueType: '',
		techniqueTypeClass: '',
		layerName: '',
		layerNameClass: '',
		layerId: 0
	},
	initialize: function(){
		//set other attributes based on layer
		if (this.attributes.layer){
			var layer = this.get('layer');
			this.set({
				layerName: layer.layerName,
				layerNameClass: layer.className,
				techniqueType: layer.techniqueType,
				techniqueTypeClass: layer.techniqueType.replace(/\s/g, ''),
				layerId: layer._leaflet_id
			});
		};
	}
});

//view for reexpress widget section
var ReexpressSectionView = Backbone.View.extend({
	el: '.reexpress-control-container',
	template: _.template( $('#reexpress-section-template').html() ),
	initialize: function(){
		this.$el.append(this.template(this.model.attributes));
	}
})

//view for reexpress radio buttons
var ReexpressInputView = Backbone.View.extend({
	template: _.template( $('#reexpress-input-template').html() ),
	setTechnique: function(e){},
	getEl: function(){
		return $('#'+this.model.get('layerNameClass')+'-reexpress-section');
	},
	setSection: function(){
		new ReexpressSectionView({model: this.model});
	},
	setEvents: function(){
		//set click listener
		var setTechnique = this.setTechnique;
		this.$el.find('input.'+this.model.get('techniqueTypeClass')).click(setTechnique);
	},
	render: function(){
		//instantiate reexpress section if needed
		if (this.getEl().length == 0){ this.setSection() };
		//set el as section div
		this.$el = this.getEl();
		//add input div for technique
		this.$el.append(this.template(this.model.attributes));
		//set event listeners
		this.setEvents();
	}
});

//model for resymbolize widget
var ResymbolizeModel = ReexpressModel.extend({
	classificationType: '',
	classificationModel: {},
	range: [],
	domain: [],
	min: 0,
	max: 0,
	scale: function(){}
});

//view for resymbolize widget section
var ResymbolizeSectionView = ReexpressSectionView.extend({
	el: '.resymbolize-control-container',
	template: _.template( $('#resymbolize-section-template').html() )
});

//view for reclassify section of resymbolize widget
var ReclassifyView = ReexpressInputView.extend({
	template: _.template( $('#reclassify-template').html() ),
	resymbolize: function(scale){},
	setScale: function(){
		var classificationModel = this.model.get('classificationModel'),
			scale = classificationModel.scale(this.model.get('domain'), this.model.get('range'));
			this.model.set('scale', scale);
			this.resymbolize(scale);
	},
	setClassification: function(view, classificationType){
		//get correct reclassify div
		var classifyDiv = view.$el.children('.reclassify');
		//set classification type in select element if first run
		if (typeof classificationType == 'undefined'){
			classificationType = view.model.get('classificationType');
			classifyDiv.find('select[name=classification]').val(classificationType);
			//hide class breaks
			classifyDiv.children('.class-breaks').hide();
		} else {
			//set classification type in model
			view.model.set('classificationType', classificationType);
			//create new classification from classification type
			var classificationModel = classification.where({type: classificationType})[0];
			view.model.set('classificationModel', classificationModel);
			//if user defined classification, reset classification
			if (classificationType == 'user defined'){
				view.setNClasses(view, view.model.get('nClasses'));
				return;
			} else {
				//reset domain to undo user defined class breaks
				view.model.set('domain', view.model.get('allvalues'));
				//if unclassified, reset range to highest and lowest classes
				if (classificationType == 'unclassed'){
					var range = view.model.get('range');
					view.model.set('range', [range[0], range[range.length-1]]);
					//set a new scale and reclassify
					view.setScale();
				} else {
					//reset range using correct number of classes
					view.setNClasses(view, view.model.get('nClasses'));
				};
			};
		};
		view.setClassBreaks();
	},
	setNClasses: function(view, nClasses){
		//get DOM elements
		var classifyDiv = view.$el.children('.reclassify'),
			nClassesSelect = classifyDiv.find('.n-classes select'),
			inputsDiv = classifyDiv.find('.class-break-inputs');
		//set up classes if the first run
		if (typeof nClasses == 'undefined'){
			var nClasses = view.model.get('nClasses'),
				min = view.model.get('min'),
				max = view.model.get('max');
			//add min and max values
			classifyDiv.find('.class-min').html(min);
			classifyDiv.find('.class-max').html(max);
			//only add 2-class option if proportional symbol
			if (view.model.get('techniqueType') == 'proportional symbol' && nClassesSelect.children('option[value=2]').length == 0){
				nClassesSelect.prepend('<option value="2">2</option>');
			};
			//add a special option if the number of classes is out of range
			if (nClasses < 2 || nClasses > 9){
				nClassesSelect.prepend('<option value="-1"></option>');
			};
			//set correct number of classes in select element
			if (nClasses > 1 && nClasses < 10){
				nClassesSelect.val(String(nClasses));
			} else {
				nClassesSelect.val('-1');
			};
		} else {
			//set the new number of classes
			view.model.set('nClasses', nClasses);
			//trigger set classes event for recolor view to pick up on
			view.model.trigger('setNClasses');
			//set display of class break inputs
			inputsDiv.find('span').each(function(){
				var i = Number($(this).attr('class').split('cb-')[1]);
				if (i < nClasses-1){
					$(this).show();
				} else {
					$(this).children('input').val('');
					$(this).hide();
				}
			});
			//designate new range for scale
			var range = view.model.get('range'),
				newRange = [];
			if (!view.model.attributes.colorbrewer){
				var interpolator = d3.interpolate(range[0], range[range.length-1]);
				for (var i = 0; i < nClasses; i++){
					newRange.push(interpolator(i/(nClasses-1)));
				};
			} else {
				//if colorbrewer scale specified, set as range
				newRange = colorbrewer[view.model.get('colorbrewer')][nClasses];
			};
			view.model.set('range', newRange);
			//if user defined classification, reset classification
			if (view.model.get('classificationType') == 'user defined'){
				view.setClassBreaks(view);
				return;
			};
			view.setScale();
		};
		view.setClassBreaks();
	},
	setClassBreaks: function(view){
		var reclassify = true;
		//use the parameter to determine if setting or using input values
		if (typeof view == 'undefined'){
			view = this;
			reclassify = false;
		};
		//get DOM elements
		var classifyDiv = view.$el.children('.reclassify'),
			inputsDiv = classifyDiv.find('.class-break-inputs');
		//get necessary variables
		var scale = view.model.get('scale'),
			domain = scale.domain(),
			range = view.model.get('range'),
			classificationType = view.model.get('classificationType');
		//hide nClasses div for unclassed
		var nClassesDiv = view.$el.find('.n-classes');
		if (classificationType == 'unclassed'){
			nClassesDiv.hide();
		} else {
			nClassesDiv.show();
		};
		if (reclassify){
			//get input values
			var classBreaks = [];
			inputsDiv.find('input').each(function(){
				var val = $(this).val();
				if (val != '' && !isNaN(parseFloat(val))){
					classBreaks.push(parseFloat(val));
				}
			});
			//set domain based on input values
			view.model.set('domain', classBreaks);
			view.setScale();
		} else {
			//set input values
			//for natural breaks, domain array is class breaks array
			if (classificationType == 'natural breaks'){
				inputsDiv.show();
				_.each(domain, function(d, i){
					inputsDiv.find('.cb-'+i+' input').val(d);
				});
			//for unclassed, no class breaks
			} else if (classificationType == 'unclassed'){
				inputsDiv.find('input').val('');
			//for quantile and equal interval, set class breaks according to range extents
			} else if (classificationType == 'quantile' || classificationType == 'equal interval') {
				inputsDiv.show();
				_.each(range, function(r, i){
					if (i < range.length-1){
						inputsDiv.find('.cb-'+i+' input').val(scale.invertExtent(r)[1]);
					};
				});
			};
			//don't reset inputs for user defined
		};
	},
	setForm: function(){
		//set model variables
		var scale = this.model.get('scale'),
			domain = this.model.get('domain');
		this.model.set('allvalues', domain);
		this.model.set('nClasses', scale.range().length);
		this.model.set('range', scale.range());
		this.model.set('min', domain[0]);
		this.model.set('max', domain[domain.length-1]);
		//set classification model
		var classificationModel = classification.where({type: this.model.get('classificationType')})[0];
		this.model.set('classificationModel', classificationModel);
		//get class break template
		var cbTemplate = _.template( $('#class-break-input-template').html() );
		//set 8 class break inputs
		for (var i = 0; i < 8; i++){
			//set display and values based on number of classes
			var display = i < scale.range().length-1 ? 'inline' : 'none';
			this.$el.find('.class-break-inputs').append(cbTemplate({
				index: i, 
				display: display
			}));
		};
		//call setup methods
		this.setNClasses(this);
		this.setClassification(this);

	},
	getEl: function(){
		return $('#'+this.model.get('layerNameClass')+'-'+this.model.get('techniqueTypeClass')+'-resymbolize-section');
	},
	setSection: function(){
		new ResymbolizeSectionView({model: this.model});
	},
	setEvents: function(){
		//set reclassify form
		this.setForm();
		//alias methods
		var view = this,
			setClassification = this.setClassification,
			setNClasses = this.setNClasses,
			setClassBreaks = this.setClassBreaks;
		
		//set reclassification listener on classification dropdown
		this.$el.find('select[name=classification]').change(function(){
			//get classification parameters
			var classificationType = $(this).val(),
				parent = $(this).parents('.reclassify');
			if ($(this).val() == 'user defined'){
				//show class breaks
				parent.find('.class-breaks').show();
			} else {
				//hide class breaks
				parent.find('.class-breaks').hide();
			};
			//reset classification
			setClassification(view, classificationType);
		});
		//set reclassification listener on nClasses dropdown
		this.$el.find('select[name=n-classes]').change(function(){
			setNClasses(view, $(this).val());
		});
		//set reclassification listener on class breaks keyup
		var timeout = setTimeout(function(){},0);
		this.$el.find('.class-break input').keyup(function(){
			clearTimeout(timeout);
			timeout = setTimeout(function(){ setClassBreaks(view) }, 1000);
		});
	}
});

//view for recolor section of resymbolize widget
var RecolorView = ReclassifyView.extend({
	template: _.template( $('#recolor-template').html() ),
	recolor: function(color){},
	setTechnique: function(){
		var techniqueType = this.model.get('techniqueType');
		if (techniqueType == 'choropleth'){
			this.$el.find('.recolor input').hide();
			this.setColorSwatches();
		} else if (techniqueType == 'proportional symbol'){
			var colorInput = this.$el.find('.recolor input');
			//hacky way to set default color of input if color is not a hex value
			if (this.model.get('color').indexOf('#') == -1){
				//set background color of input
				colorInput.css('background-color', this.model.get('color'));
				//get rgb color value and convert to hex value
				var rgb = colorInput.css('background-color').replace(/rgb\(|\)/g, '').split(','),
					red = parseInt(rgb[0]), green = parseInt(rgb[1]), blue = parseInt(rgb[2]),
					//from http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb response by FilipeC
					rgb2 = blue | (green << 8) | (red << 16),
					hex = '#' + (0x1000000 + rgb2).toString(16).slice(1);
				//remove background color of input
				colorInput.removeAttr('style');
			} else {
				var hex = this.model.get('color');
			};
			//set default color of input 
			colorInput.attr('value', hex);
			//hide color scale select
			this.$el.find('.recolor select').hide();
			//add color change event
			var recolor = this.recolor;
			colorInput.change(function(){
				recolor($(this).val());
			});
		};
	},
	setColorSwatches: function(){
		//get variables
		var view = this,
			nClasses = this.model.get('nClasses');
		//retrieve templates
		var optionTemplate = _.template( $('#color-scale-option-template').html() ),
			swatchTemplate = _.template( $('#color-swatch-template').html() );
		//get select element
		var select = this.$el.find('.color-scale');
		//clear select in case previously filled
		select.empty();
		//set options and swatches
		for (var scheme in colorbrewer){
			//only include schemes that have full number of classes
			if (colorbrewer[scheme][nClasses]){
				//set option
				select.append(optionTemplate({colorcode: scheme}));
				var option = this.$el.find('.color-scale option[value='+scheme+']');
				//add swatches to option
				_.each(colorbrewer[scheme][nClasses], function(color){
					option.append(swatchTemplate({
						stroke: '#000',
						fillColor: color
					}));
				});
			};
		};
		//set reclassify event listener
		select.change(function(){
			//set colorbrewer array
			view.model.set('colorbrewer', $(this).val());
			//set range to new color scale array
			var range = colorbrewer[$(this).val()][nClasses];
			view.model.set('range', range);
			//reset scale and reclassify
			view.setScale();
		});
	},
	setLabelAttribute: function(){
		var techniqueType = this.model.get('techniqueType'),
			label = false;
		if (techniqueType == 'choropleth'){
			label = 'Color scale';
			this.$el.find('input').hide();
			this.setColorSwatches();
		} else if (techniqueType == 'proportional symbol'){
			label = 'Symbol color';
			this.$el.find('.recolor select').hide();
		};
		this.model.set('recolorLabel', label);
	},
	initialize: function(){
		this.setLabelAttribute();
	},
	setEvents: function(){
		//call setup methods
		this.setTechnique();
		this.model.on('setNClasses', this.setColorSwatches, this);
	}
});

//view for rescale section of resymbolize widget
var RescaleView = RecolorView.extend({
	template: _.template( $('#rescale-template').html() ),
	setLabelAttribute: function(){
		var techniqueType = this.model.get('techniqueType'),
			label = false;
		if (techniqueType == 'proportional symbol'){
			label = 'Symbol radii';
		} else if (techniqueType == 'heat'){
			label = 'Point radius';
		} else if (techniqueType == 'dot' || techniqueType == 'isarithmic'){
			label = 'Interval';
		};
		this.model.set('rescaleLabel', label);
	},
	setEvents: function(){
		var techniqueType = this.model.get('techniqueType'),
			minInput = this.$el.find('input[name=scale-value-min]'),
			maxInput = this.$el.find('input[name=scale-value-max]'),
			view = this,
			model = this.model,
			timeout = setTimeout(function(){},0);
		if (techniqueType == 'proportional symbol'){
			var scale = model.get('scale'),
				range = scale.range();
			//pre-set input values
			minInput.val(range[0]);
			maxInput.val(range[range.length-1]);
			//set keyup listener
			view.$el.find('.rescale input').keyup(function(){
				clearTimeout(timeout);
				timeout = setTimeout(function(){
					var min = minInput.val().length > 0 ? parseFloat(minInput.val()) : 0,
						max = parseFloat(maxInput.val()),
						classificationType = view.$el.find('select[name=classification]').val();
					if (!isNaN(min) && !isNaN(max)){
						model.set('range', [min, max]);
						view.setClassification(view, classificationType);
					};
				}, 500);
			});
		} else {
			//hide min input and min/max labels
			view.$el.find('.scale-value-hideable').hide();
			var layerModel = model.get('layer').model,
				inputVal = layerModel.get('interval') || layerModel.get('size');
			maxInput.val(inputVal);
			//set keyup listener
			maxInput.keyup(function(){
				clearTimeout(timeout);
				timeout = setTimeout(function(){
					//param is isarithm interval or point radius
					var param = parseFloat(maxInput.val());
					if (!isNaN(param)){
						view.resymbolize(param);
					};
				}, 500);
			});
		};
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
	//all available interactions
	interactions: {
		zoom: false,
		pan: false,
		retrieve: false,
		overlay: false,
		search: false,
		filter: false,
		sequence: false,
		reexpress: false,
		resymbolize: false,
		reproject: false
	},
	render: function(){
		this.$el.html("<div id='map'>");
		this.model.set('allFeatures', []);
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
	topoToGeoJSON: function(transform, arcs, objects, crs){
		//recreate topojson topology
		var topology = {
			type: 'Topology',
			transform: transform,
			arcs: arcs,
			objects: objects,
			crs: crs
		};
		//use topojson.js to translate first object in topology
		return topojson.feature(topology, objects[Object.keys(objects)[0]]);
	},
	setTechniques: function(dataLayerModel){
		//variables needed by internal functions
		var view = this, 
			model = view.model,
			map = view.map;
		//translate topojson
		if (dataLayerModel.attributes.type && dataLayerModel.get('type') == 'Topology'){
			var featureCollection = view.topoToGeoJSON(dataLayerModel.get('transform'), dataLayerModel.get('arcs'), dataLayerModel.get('objects'), dataLayerModel.get('crs'));
			dataLayerModel.set('features', featureCollection.features);
		};
		//add new features to collection of all features
		model.attributes.allFeatures = _.union(model.attributes.allFeatures, dataLayerModel.get('features'));
		//trigger event for features
		view.trigger(dataLayerModel.get('className')+'-features-added');

		//Leaflet layer style function
		function style(feature){
			//combine layer options objects from config file and feature properties
			//classification will take precedence over base options
			return _.defaults(feature.properties.layerOptions, dataLayerModel.get('layerOptions'));
		};

		//create a new Leaflet layer for each technique
		_.each(dataLayerModel.get('techniques'), function(technique, i){
			//instantiate new model based on technique type and combine with data layer model
			var techniqueModel = new techniquesObj[technique.type]({techniqueIndex: i});
			_.defaults(techniqueModel, dataLayerModel);
			_.extend(techniqueModel.attributes, dataLayerModel.attributes);
			if (technique.type == 'heat'){
				techniqueModel.setHeatmap = function(tModel){
					var expressedAttribute = tModel.get('expressedAttribute'),
						features = tModel.polygonsToPoints(tModel.get('features'), expressedAttribute),
						values = getAllAttributeValues(features, expressedAttribute),
						points = tModel.featuresToDataPoints(features, expressedAttribute),
						technique = tModel.get('techniques')[tModel.get('techniqueIndex')],
						size = technique.size ? technique.size : 1;
					//leaflet heatmap layer data
					var data = {
						max: values[values.length-1],
						data: points
					};
					//leaflet heatmap layer config
					var heatmapConfig = {
						radius: size,
						maxOpacity: 0.8,
						scaleRadius: true,
						useLocalExtrema: true,
						latField: 'lat',
						lngField: 'lng',
						valueField: expressedAttribute
					};
					//leaflet heatmap layer instance
					var heatmapLayer = new HeatmapOverlay(heatmapConfig);
					heatmapLayer.setData(data);
					tModel.set('heatmapLayer', heatmapLayer);
				};
			};
			//set model classification, isarithms, or dots
			techniqueModel.symbolize();

			//add popups to layer
			function onEachFeature(feature, layer){
				if (!feature.layers){ feature.layers = [] };
				feature.layers.push(layer); //bind layer to feature for search
				var popupContent = "<table>";
				if (dataLayerModel.attributes.displayAttributes){
					dataLayerModel.get('displayAttributes').forEach(function(attr){
						popupContent += _.template($('#popup-line-template').html())({
							attribute: attr,
							value: feature.properties[attr]
						});
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
			};
			//Leaflet overlay options
			var overlayOptions = {
				onEachFeature: onEachFeature,
				style: style,
				className: dataLayerModel.get('className')
			};

			//special processing for prop symbol maps
			if (technique.type == 'proportional symbol'){
				//implement pointToLayer conversion for proportional symbol maps
				function pointToLayer(feature, latlng){
					var markerOptions = style(feature);
					if (techniqueModel.get('symbol') == 'circle' || !techniqueModel.attributes.symbol){
						return L.circleMarker(latlng, markerOptions);
					} else {
						var width = markerOptions.radius * 2;
						var icon = L.icon({
							iconUrl: techniqueModel.get('symbol'),
							iconSize: [width, width]
						});
						return L.marker(latlng, {icon: icon})
					};
				};
				//add pointToLayer to create prop symbols
				overlayOptions.pointToLayer = pointToLayer;
			};
			//instantiate Leaflet layer
			if (technique.type == 'heat'){
				var leafletDataLayer = techniqueModel.get('heatmapLayer');
			} else {
				var leafletDataLayer = L.geoJson(techniqueModel.get('features'), overlayOptions);
			};
			var	layerId = leafletDataLayer._leaflet_id;
			leafletDataLayer.model = techniqueModel;
			leafletDataLayer.layerName = techniqueModel.get('name');
			leafletDataLayer.className = techniqueModel.get('className');
			leafletDataLayer.techniqueType = technique.type;

			//render immediately by default
			if (i==0 && (typeof dataLayerModel.get('renderOnLoad') === 'undefined' || dataLayerModel.get('renderOnLoad') == true)){
				//add layer to map
				leafletDataLayer.addTo(map);
			} else {
				//stick it in offLayers array
				view.offLayers[layerId] = leafletDataLayer;
			};
			//add to layers
			model.attributes.leafletDataLayers.push(leafletDataLayer);

			//interval needed to keep checking if layer not yet fully processed
			var interval = setInterval(triggerDone, 100);
			function triggerDone(){
				//check to make sure layer has been fully processed
				if (map.hasLayer(leafletDataLayer) || view.offLayers[layerId]){
					clearInterval(interval);
					//if the last layer, trigger the done event
					if (dataLayerModel.id == model.get('dataLayers').length-1 && techniqueModel.get('techniqueIndex') == techniqueModel.get('techniques').length-1){
						view.trigger('dataLayersDone');
					};
				};
			};			
		}, this);
	},
	setDataLayer: function(dataLayer, i){
		//global object to hold non-mapped layers
		if (!window.offLayers){ window.offLayers = {}; };
		//replace any periods in name and set class name
		dataLayer.name = dataLayer.name.replace(/\./g, '');
		dataLayer.className = dataLayer.name.replace(/\s/g, '-');
		//instantiate model for data layer
		var dataLayerModel = new DataLayerModel(dataLayer);
		//handle for determining layer order
		dataLayerModel.set('id', i);
		//get data and create thematic layers
		dataLayerModel.on('sync', this.setTechniques, this);
		if (dataLayer.source.indexOf('postgis:') != -1){
			//fetch features from postgis database
			dataLayerModel.fetch({
				url: 'php/getData.php',
				async: false,
				data: {
					table: dataLayer.source.split('postgis:')[1]
				}
			});
		} else {
			//fetch features from geojson or topojson
			dataLayerModel.fetch({
				url: dataLayer.source,
				async: false
			});
		};
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
			var innerHTML = '<div class="open button" title="click to open legend"><img src="img/icons/legend.png" alt="legend"><span class="control-title">Legend</span></div><div id="legend-wrapper">';
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
		//add heatmap symbol for heatmaps
		$('.heatmap-symbol').each(function(){
			var domain = $(this).parent().find('text').html().split(' - ');
			var heatmapInstance = h337.create({
				container: this,
				radius: 10,
				maxOpacity: 0.8
			});
			heatmapInstance.setData({
				max: domain[1],
				min: domain[0],
				data: [{
					x: 10,
	                y: 10,
	                value: domain[1]
				}]
			});
		});
		
		//add close button
		var closeButton = _.template( $('#close-button-template').html() );
		$('.legend-control-container').append(closeButton({x: $('.legend-control-container').width() - 20 + "px"}));
		//add open and close listeners
		$('.legend-control-container .open').click(function(){
			$('#legend-wrapper, .legend-control-container .close').show();
		});
		$('.legend-control-container .close').click(function(){
			$('#legend-wrapper, .legend-control-container .close').hide();
		});
		//hide everything but icon to start
		$('#legend-wrapper').hide();
	},
	setMapInteractions: {
		zoom: function(controlView, leafletView){
			var map = leafletView.map,
				zoomOptions = leafletView.model.get('interactions').zoom;
			//object to reference zoom interface options to Leaflet methods
			var interfaceMethods = {
				touch: map.touchZoom,
				scrollWheel: map.scrollWheelZoom,
				doubleClick: map.doubleClickZoom,
				box: map.boxZoom,
				keyboard: map.keyboard
			};
			//set on/off scripts
			controlView.addInteraction = function(){
				for (var method in interfaceMethods){
					//skip any interface methods set to false
					if (zoomOptions.interface && zoomOptions.interface.hasOwnProperty(method) && zoomOptions.interface[method] == false){
						continue;
					};
					//enable other methods
					if (method == 'keyboard'){
						interfaceMethods[method]._setZoomOffset(1);
					} else {
						interfaceMethods[method].enable();
					}
				};
			};
			controlView.removeInteraction = function(){
				map.touchZoom.disable();
				map.scrollWheelZoom.disable();
				map.doubleClickZoom.disable();
				map.boxZoom.disable();
				map.keyboard._setZoomOffset(0);
			};
			//if widget is not set to false, add it
			if (!zoomOptions.interface || !zoomOptions.interface.hasOwnProperty('widget') || zoomOptions.interface.widget){
				//add zoom control to map
				L.control.zoom({position: 'bottomleft'}).addTo(map);
				//customize zoom control style
				var zoomControl = $('.leaflet-control-zoom');
				zoomControl.css({
					border: '2px solid #000',
					'box-shadow': 'none',
					'float': 'none',
					margin: '10px auto 0',
					opacity: '0.5',
					width: '26px'
				});
				zoomControl.wrap('<div class="zoom-control-container control-container leaflet-control">');
				var zoomContainer = $('.zoom-control-container');
				zoomContainer.prepend('<img class="icon" src="img/icons/zoom.png" alt="zoom" title="zoom"><span class="control-title">zoom</span>');
				//hide zoom control
				zoomContainer.hide();
			};
			return controlView;
		},
		pan: function(controlView, leafletView){
			var map = leafletView.map,
				panOptions = leafletView.model.get('interactions').pan,
				autopan = false;
			//event listener to log pan interaction
			function triggerPan(){
				if (!autopan){
					leafletView.trigger('pan');
				};
			};
			//set timer to avoid autopan triggering	
			map.on('autopanstart', function(){
				autopan = true;
				setTimeout(function(){ autopan = false }, 500);
			});
			//on/off scripts
			controlView.addInteraction = function(){
				//if interface option is not set to false, add it
				if (!panOptions.interface || !panOptions.interface.hasOwnProperty('drag') || panOptions.interface.drag){
					map.dragging.enable();
				};
				if (!panOptions.interface || !panOptions.interface.hasOwnProperty('keyboard') || panOptions.interface.keyboard){
					map.keyboard._setPanOffset(80);
				};
				//set cursor to grab if no retrieve
				if (!leafletView.interactions.retrieve || leafletView.interactions.retrieve == 'inactive'){
					$('.leaflet-interactive').css('cursor', 'grab');
				};
				map.on('moveend', triggerPan);
			};
			controlView.removeInteraction = function(){
				map.dragging.disable();
				map.keyboard._setPanOffset(0);
				//set cursor to pointer if no retrieve
				if (!leafletView.interactions.retrieve || leafletView.interactions.retrieve == 'inactive'){
					$('.leaflet-interactive').css('cursor', 'default');
				};
				map.off('moveend', triggerPan);
			};
			//if widget is not set to false, add it
			if (!panOptions.interface || !panOptions.interface.hasOwnProperty('widget') || panOptions.interface.widget){
				//add pan control to map and hide
				var PanControl = leafletView.CustomControl('pan', 'bottomleft');
				var panControl = new PanControl();
				map.addControl(panControl);
				var panControlView = new PanControlView();
				//widget-based pan-handler
				panControlView.panMap = function(target){
					switch (target){
						case 'pan-up':
							map.panBy([0, -80]); break;
						case 'pan-left':
							map.panBy([-80, 0]); break;
						case 'pan-right':
							map.panBy([80, 0]); break;
						case 'pan-down':
							map.panBy([0, 80]); break;
					};
				};
			};
			$('.pan-control-container').hide();
			return controlView;
		},
		retrieve: function(controlView, leafletView){
			var map = leafletView.map;
			//listener handler for posting retrieve interaction
			function triggerRetrieve(){
				leafletView.trigger('retrieve');
			};
			controlView.addInteraction = function(){
				//close any hidden-but-open popups
				map.closePopup();
				$('.leaflet-popup-pane').show();
				$('.leaflet-interactive').removeAttr('style');
				map.on('popupopen', triggerRetrieve);
			};
			controlView.removeInteraction = function(){
				$('.leaflet-popup-pane').hide();
				//set cursor to grab if pan active or default if not
				if (leafletView.interactions.pan == 'active'){
					$('.leaflet-interactive').css('cursor', 'grab');
				} else {
					$('.leaflet-interactive').css('cursor', 'default');
				};
				map.off('popupopen', triggerRetrieve);
			};
			//get interface options
			var retrieveOptions = leafletView.model.get('interactions').retrieve;
			//add retrieve window if not included in options or true
			if (!retrieveOptions.interface || typeof retrieveOptions.interface.window == 'undefined' || retrieveOptions.interface.window == true){
				//add retrieve control to map and hide
				var RetrieveControl = leafletView.CustomControl('retrieve', 'bottomleft');
				var retrieveControl = new RetrieveControl();
				map.addControl(retrieveControl);
				//instantiate view
				var retrieveControlView = new RetrieveControlView();
				map.on('popupopen', function(p){
					$('.retrieve-attributes').html(p.popup.getContent());
				});
				map.on('popupclose', function(){
					retrieveControlView.retrieve();
				});
			};
			//make popups visible if not included in options or true
			if (!retrieveOptions.interface || typeof retrieveOptions.interface.popup == 'undefined' || retrieveOptions.interface.popup == true){
				//add retrieve-control-container class to allow popup pane show/hide
				var popupPane = $('.leaflet-popup-pane');
				popupPane.attr('class', popupPane.attr('class') + ' retrieve-control-container');
			};
			return controlView;
		},
		overlay: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;
			//add overlay control
			var OverlayControl = leafletView.CustomControl('overlay', 'bottomleft');
			var overlayControl = new OverlayControl();
			map.addControl(overlayControl);

			//add to overlay control
			leafletView.on('dataLayersDone', function(){
				_.each(leafletView.model.get('leafletDataLayers'), function(dataLayer){
					var layerId = dataLayer._leaflet_id;
					var overlayControlModel = new OverlayControlModel({
						layerName: dataLayer.layerName,
						layerId: layerId,
						techniqueType: dataLayer.techniqueType
					});
					var overlayControlView = new OverlayControlView({model: overlayControlModel});
					//toggleLayer function must be defined for leaflet view
					overlayControlView.toggleLayer = function(layerId, addLayer){
						//trigger interaction logging if toggle was not due to reexpression
						if (!leafletView.reexpressed){ leafletView.trigger('overlay'); };
						//turn layer on/off
						if (map._layers[layerId] && !addLayer){
							leafletView.removeLayer(layerId);
						} else if (!map._layers[layerId] && offLayers[layerId]){
							leafletView.addLayer(layerId);
						};
					};
					overlayControlView.render();
					//only show the layers that are on the map
					if (offLayers[layerId]){
						$('#overlay-layer-'+layerId).hide();
					} else {
						$('#overlay-layer-'+layerId+' input').prop('checked', true);
					};
				}, this);
			}, this);

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
			var map = leafletView.map;
			//add search control to map and hide
			var SearchControl = leafletView.CustomControl('search', 'bottomleft');
			var searchControl = new SearchControl();
			map.addControl(searchControl);
			var searchInputView = new SearchInputView();
			searchInputView.on('reset', function(){
				map.setView(leafletView.model.get('mapOptions').center, leafletView.model.get('mapOptions').zoom);
				map.closePopup();
			}, this);
			$('.search-control-container').hide();
			//instantiate a view to call and display results
			var searchView = new SearchView();
			//function to show popup for clicked feature
			searchView.selectFeature = function(e, result){
				//reveal popups pane if retrieve is off
				map.closePopup();
				$('.leaflet-popup-pane').show();
				//open the retrieve popup or just the feature name if no retrieve
				_.each(result.layers, function(layer){
					if (map.hasLayer(layer)){
						if (layer._popup){
							layer.openPopup();
						} else {
							layer.openPopup(result.properties.name);
						};
						//reset map center to avoid overlapping search box
						var center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
						map.setView(center, null, {pan: {animate: false}});
						map.panBy([-50, 0]);
						//disable further popups if retrieve is off
						if (leafletView.interactions.retrieve == 'inactive'){
							layer.on('popupclose', function(){
								$('.retrieve-control-container').hide();
								layer.off('popupclose');
							});
						};
					}
				}, this);
			};
			//replace search model when mapped layers change
			function setSearchInput(){
				//reset search widget content
				$('#search-box input').val('');
				$('#search-results-box').empty();
				var allFeatures = [];
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					if (layer.techniqueType != 'heat' && map.hasLayer(layer)){
						allFeatures = _.union(allFeatures, layer.toGeoJSON().features);
					};
				});
				var options = {
					keys: ['properties.name']
				};
				//create a model for the data
				var searchModel = new SearchModel({
					allFeatures: allFeatures,
					searchOptions: options
				});
				//build Fuse search
				searchModel.createSearch();
				searchView.model = searchModel;
			};
			//reset widget on add and layer change
			controlView.addInteraction = setSearchInput;
			map.on('layeradd layerremove', setSearchInput);
			//return UI
			return controlView;
		},
		filter: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;
			//add control to map
			var CustomControl = leafletView.CustomControl('filter', 'bottomleft');
			var filterControl = new CustomControl();
			map.addControl(filterControl);

			//applyFilter function references map, so must be created here
			function applyFilter(attribute, values, init){
				//helpful abbreviations
				var min = values[0], max = values[1];
				//remove layers outside of filter range
				map.eachLayer(function(layer){
					if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
						var layerValue = layer.feature.properties[attribute];
						//if value falls outside range, remove from map and stick in removed layers array
						if (layerValue < min || layerValue > max){
							map.removeLayer(layer);
							offLayers[layer._leaflet_id + '-filter'] = layer;
						};
					};
					//special processing for heat map layer
					if (layer.techniqueType && layer.techniqueType == 'heat' && typeof init == 'undefined' && layer._data[0].hasOwnProperty(attribute)){
						//add off data object if it doesn't exist
						if (!leafletView.hasOwnProperty('offData')){
							leafletView.offData = {};
						};
						//add a specific data array for the layer
						if (!leafletView.offData.hasOwnProperty(layer.layerName)){
							leafletView.offData[layer.layerName] = [];
						};
						var layerData = layer._data,
							newData = [],
							offData = leafletView.offData[layer.layerName];
						//remove data that fall within filter range from offData array and add to layer
						_.each(offData, function(datum){
							if (datum[attribute] >= min && datum[attribute] <= max){
								newData.push(datum);
								offData = _.without(offData, datum);
							};
						});
						//pass new offData array to view object
						leafletView.offData[layer.layerName] = offData;
						//remove data that fall outside of filter range from layer and put in offData array
						_.each(layerData, function(datum){
							var newDatum = {
								lat: datum.latlng.lat,
								lng: datum.latlng.lng
							};
							newDatum[attribute] = datum[attribute];
							if (datum[attribute] < min || datum[attribute] > max){
								leafletView.offData[layer.layerName].push(newDatum);
							} else {
								newData.push(newDatum);
							};
						});
						//reset heatmap layer
						layer.setData({data: newData});
					};
				});
				//add layers within filter range
				_.each(offLayers, function(layer){
					if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
						var layerValue = layer.feature.properties[attribute];
						//if value within range, add to map and remove from removed layers array
						if (layerValue > min && layerValue < max){
							layer.addTo(map);
							delete offLayers[layer._leaflet_id + '-filter'];
						};
					};
				});

			};
			//get interaction variables
			var filterLayers = leafletView.model.get('interactions.filter.dataLayers'),
				controlType = leafletView.model.get('interactions.filter.tool');
			//set a tool for each included data layer
			_.each(leafletView.model.get('dataLayers'), function(dataLayer){
				//test for inclusion of data layer in filter interaction
				if (_.indexOf(filterLayers, dataLayer.name) > -1){
					//get filter properties
					var attributes = dataLayer.displayAttributes || [dataLayer.expressedAttribute];
					//create filter view
					var filterView = controlType == 'logic' ? new FilterLogicView({applyFilter: applyFilter}) : new FilterSliderView({applyFilter: applyFilter});
					//dataLayer className hasn't been defined yet, so must use name here
					var className = dataLayer.name.replace(/\./g, '').replace(/\s/g, '-');
					//when the features are loaded, render the tool
					leafletView.once(className+'-features-added', function(){
						//set a filter tool
						var filterModel = new FilterModel({layerName: dataLayer.name, className: dataLayer.className, attributes: attributes, tool: controlType, map: map, features: leafletView.model.get('allFeatures')});
						filterView.model = filterModel;
						filterView.render();
						//trigger filter event on slider stop or logic filter entry
						var timeout = window.setTimeout(function(){}, 0);
						$('#'+dataLayer.className+'-slider').on('slidestop', function(){ leafletView.trigger('filter'); });
						$('#'+dataLayer.className+'-logic-div input').on('keyup', function(){
							clearTimeout(timeout);
							timeout = window.setTimeout(function(){ leafletView.trigger('filter'); }, 1000);
						});
					});
				};
			}, leafletView);
			//function to reset filter inputs
			controlView.removeInteraction = function(){
				//reset filter sliders
				$('.range-slider').each(function(){
					var layerName = $(this).attr('id').split('-');
					layerName.pop();
					layerName = layerName.join('-');
					var sliderOptions = $(this).slider('option');
					$(this).slider('values', [sliderOptions.min, sliderOptions.max]);
					$('#'+layerName+'-labels .left').text(sliderOptions.min);
					$('#'+layerName+'-labels .right').text(sliderOptions.max);
				});
				//reset logic inputs
				$('.filter-row input').val('');
				//reset layers
				_.each(offLayers, function(layer){
					if (offLayers[layer._leaflet_id + '-filter']){
						layer.addTo(map);
						delete offLayers[layer._leaflet_id + '-filter'];
					};
				});
			};
			//update filter on overlay change
			leafletView.map.on('layeradd layerremove', function(e){
				if (e.layer.className){
					var layerName = e.layer.className;
					if (e.type == 'layeradd'){
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
						//reset and disable logic inputs
						$('#'+layerName+'-logic-div input').val('');
						$('#'+layerName+'-logic-div input').prop('disabled', true);
					}
				};	
			});

			return controlView;
		},
		reexpress: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;

			//add control to map
			var CustomControl = leafletView.CustomControl('reexpress', 'bottomleft');
			var reexpressControl = new CustomControl();
			map.addControl(reexpressControl);

			//set inputs
			function setInputs(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					//create reexpressModel for layer
					var reexpressModel = new ReexpressModel({ layer:layer });
					//instantiate section and input views
					var reexpressInputView = new ReexpressInputView({model: reexpressModel});
					reexpressInputView.setTechnique = function(e){
						var target = $(e.target),
							targetVal = target.val(),
							inputs = target.parents('.reexpress-section').find('input');
						//remove all map layers for given data layer
						_.each(inputs, function(input){
							var inputVal = $(input).val();
							//this ensures single-technique layers can be moved to top
							if (leafletView.map._layers[inputVal]){
								leafletView.removeLayer(inputVal);
								//fire reexpress event if layer was changed
								if (inputVal != targetVal){
									leafletView.trigger('reexpress');
								};
							};
							//hide overlay control inputs for inactive layers
							if (inputVal != targetVal){
								$('#overlay-layer-'+inputVal).hide();
							};
						});
						//add selected map layer
						if (!map._layers[targetVal]){
							leafletView.addLayer(targetVal);
							//show corresponding overlay control input
							$('#overlay-layer-'+targetVal+' input').prop('checked', true);
							$('#overlay-layer-'+targetVal).show();
						};
						//set cursor based on presence of other interactions
						if (leafletView.interactions.retrieve == 'active'){
							$('.leaflet-interactive').css('cursor', 'pointer');
						} else if (leafletView.interactions.pan == 'active'){
							$('.leaflet-interactive').css('cursor', 'grab');
						} else {
							$('.leaflet-interactive').css('cursor', 'default');
						};
					};
					//render input views
					reexpressInputView.render();
				}, this);
			};
			//function to check radio for currently expressed layers
			function resetTechniques(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					if (map.hasLayer(layer)){
						var techniqueType = layer.techniqueType.replace(/\s/g, '');
						//check the radio button for layer in reexpress widget
						$('.reexpress-control-container input[name='+layer.className+'].'+techniqueType).prop('checked', true);
					};
				}, this);
			};
			//add data layers after loaded
			leafletView.on('dataLayersDone', function(){
				setInputs();
				resetTechniques();
			}, this);
			//disable reexpress for data layers not shown on map
			map.on('layeradd layerremove', function(e){
				if (e.layer.className && e.layer.techniqueType){
					var layerSection = $('#'+e.layer.className+'-reexpress-section');
					if (e.type == 'layerremove'){
						layerSection.find('input').prop('disabled', true);
						layerSection.find('label').css('opacity', '0.5');
					} else {
						layerSection.find('input').removeProp('disabled');
						layerSection.find('label').css('opacity', '1');
					};
				};
			});
			return controlView;
		},
		resymbolize: function(controlView, leafletView){
			var map = leafletView.map;
			//add control to map
			var CustomControl = leafletView.CustomControl('resymbolize', 'bottomleft');
			var resymbolizeControl = new CustomControl();
			map.addControl(resymbolizeControl);
			//show/hide data layer tools when layers change
			function toggleTools(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					var layerToolsDiv = $('#'+layer.className+'-'+layer.techniqueType.replace(/\s/g,'')+'-resymbolize-section');
					//show or hide tools for layer
					if (map.hasLayer(layer)){
						layerToolsDiv.show();
					} else {
						layerToolsDiv.hide();
					};
				});
			};
			//set resymbolize tools
			function setTools(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					var expressedAttribute = layer.model.get('expressedAttribute'),
						technique = layer.model.get('techniques')[layer.model.get('techniqueIndex')];
					//create resymbolizeModel for layer
					var resymbolizeModel = new ResymbolizeModel({
						layer: layer
					});
					if (layer.techniqueType != 'heat'){
						resymbolizeModel.set({
							classificationType: technique.classification,
							domain: getAllAttributeValues(layer.toGeoJSON().features, expressedAttribute),
							scale: layer.model.get('scale')
						});
					};

					if (layer.techniqueType == 'choropleth'){
						//add colorbrewer scheme name if used
						if (typeof technique.classes == 'string'){
							resymbolizeModel.set('colorbrewer', technique.classes.split('.')[0]);
						};
						//instantiate appropriate views
						var reclassifyView = new ReclassifyView({model: resymbolizeModel}),
							recolorView = new RecolorView({model: resymbolizeModel});
						//designate resymbolize function specific to Leaflet
						reclassifyView.resymbolize = function(scale){
							layer.eachLayer(function(sublayer){
								var style = {
									fillColor: scale(sublayer.feature.properties[expressedAttribute])
								};
								sublayer.setStyle(style);
							});
							leafletView.trigger('resymbolize');
						};
						//recolor method is reclassification
						recolorView.resymbolize = reclassifyView.resymbolize;
						//render views
						reclassifyView.render();
						recolorView.render();
					} else if (layer.techniqueType == 'proportional symbol'){
						//add symbol color to model
						var layerOptions = layer.model.get('layerOptions');
						var color;
						if (layerOptions.fillColor){
							color = layerOptions.fillColor;
						} else if (layerOptions.fill){
							color = layerOptions.fill;
						} else {
							color = "#000";
						};
						resymbolizeModel.set('color', color);
						//instantiate appropriate views
						var reclassifyView = new ReclassifyView({model: resymbolizeModel}),
							rescaleView = new RescaleView({model: resymbolizeModel}),
							recolorView = new RecolorView({model: resymbolizeModel});
						//designate resymbolize function specific to Leaflet
						reclassifyView.resymbolize = function(scale){
							layer.eachLayer(function(sublayer){
								var radius = scale(sublayer.feature.properties[expressedAttribute]);
								sublayer.setRadius(radius);
							});
							leafletView.trigger('resymbolize');
						};
						//rescaleView also changes radius with new scale
						rescaleView.resymbolize = reclassifyView.resymbolize;
						//recolor function takes a single color as parameter rather than scale
						recolorView.recolor = function(color){
							layer.eachLayer(function(sublayer){
								sublayer.setStyle({fillColor: color});
							});
							leafletView.trigger('resymbolize');
						};
						//render views
						reclassifyView.render();
						rescaleView.render();
						recolorView.render();
					} else if (layer.techniqueType == 'isarithmic'){
						//instantiate just rescale view
						var rescaleView = new RescaleView({model: resymbolizeModel});
						//designate resymbolize function specific to Leaflet
						rescaleView.resymbolize = function(interval){
							//remove all isarithms from layer group
							layer.clearLayers();
							//reset isarithms
							layer.model.setIsarithms(interval);
							//add new isarithms to layer group
							_.each(layer.model.get('features'), function(isarithm, i){
								layer.addLayer(L.geoJson(isarithm, {
									style: _.defaults(isarithm.properties.layerOptions, layer.model.get('layerOptions'))
								}));
							});
						};
						//render rescale view
						rescaleView.render();
					} else if (layer.techniqueType == 'heat'){
						//instantiate just rescale view
						var rescaleView = new RescaleView({model: resymbolizeModel});
						//designate resymbolize function specific to Leaflet
						rescaleView.resymbolize = function(radius){
							//reset heatmap
							layer.cfg.radius = radius;
							layer._draw();
							leafletView.trigger('resymbolize');
						};
						//render rescale view
						rescaleView.render();
					} else if (layer.techniqueType == 'dot'){

					};
				}, this);
				//switch which tools are visible when layers change
				map.on('layeradd layerremove', toggleTools);
				//set initial visibility
				toggleTools();
			};

			//add tools for data layers after loaded
			leafletView.on('dataLayersDone', function(){
				setTools();
			}, this);

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
				//listen for toggle to set status of interaction in map view
				interactionToggleView.on('toggle', function(e){
					this.interactions[e.interaction] = e.state;
				}, this);
				//add controls and scripts for each included interaction
				if (this.setMapInteractions[interaction]){
					interactionToggleView = this.setMapInteractions[interaction](interactionToggleView, this);
					//change interaction property of Leaflet view from false to 'inactive'
					this.interactions[interaction] = 'inactive';
				};
				//render interaction toggle button
				interactionToggleView.render();
			};
		}, this);

		this.on('dataLayersDone', function(){
			//set legend control
			if (typeof this.model.get('mapOptions.legend') == 'undefined' || this.model.get('mapOptions.legend')){
				this.addLegend();
			};
			//prevent retrieve by default
			$('.leaflet-popup-pane').hide();
			$('.leaflet-interactive').css('cursor', 'default');
		}, this);
	},
	logInteractions: function(){
		//designate events to listen to with contexts for each interaction
		var interactionCreation = {
			zoom: {zoomstart: this.map},
			pan: {pan: this},
			retrieve: {retrieve: this},
			overlay: {overlay: this},
			underlay: {baselayerchange: this.map},
			search: {search: this},
			filter: {filter: this},
			reexpress: {reexpress: this},
			resymbolize: {resymbolize: this}
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
(function(){

//object to hold all data
var allData = {
	"interface": [],
	"mpages": [],
	"qpages": [],
	"conditions": [],
	"server": {}
};

//templates
var optionTemplate = _.template( $('#option-template').html() ),
	dropdownTemplate = _.template( $('#dropdown-template').html() );

var PageModel = Backbone.Model.extend({
	defaults: {
		pagenum: 1,
		library: 'Leaflet'
	}
});

var pageModel = new PageModel();

var PageView = Backbone.View.extend({
	tagName: 'div',
	className: 'page',
	template: _.template( $('#page-template').html() ),
	events: {
		"click .removepage": "removepage",
		"click .addpage": "addpage",
		"click .addDataLayer": "addDataLayer",
		"change select[name=library]": "setLibrary",
		"change .i-checkbox": "toggleInteraction",
		"change .fullpage": "toggleMaponpage",
		"change .maponpage": "toggleFullpage"
	},
	removepage: function(){
		//reset page numbering
		this.model.set('pagenum', this.model.get('pagenum')-1);
		//fade out and remove view
		var view = this;
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of page boxes once element has been removed
			var pagenum = 0;
			$('.page').each(function(){
				pagenum++;
				$(this).attr('id', "page-"+pagenum);
				$(this).find('.pagenum').html(pagenum);
			});
		});
	},
	addpage: function(){
		createPage(this.model.get('pagenum')+1);
	},
	setInteractionOptions: function(){
		var loggingTemplate = _.template( $('#interaction-logging-template').html() ),
			pagenum = this.model.get('pagenum');
		this.$el.find('.i-section').each(function(){
			var interaction = $(this).attr('class').split(' ')[0];
			$(this).prepend(loggingTemplate({pagenum: pagenum, interaction: interaction}));
			$(this).find('input, select').attr('disabled', true);
			$(this).hide();
		});
	},
	toggleInteraction: function(e){
		var isection = $(e.target).parent().parent().find('.i-section');
		if (e.target.checked){
			isection.find('input, select').removeAttr('disabled');
			isection.slideDown(250);
		} else {
			isection.slideUp(250);
			isection.find('input, select')
		};
	},
	toggleMaponpage: function(e){
		if (e.target.value == "true"){
			this.$el.find('.maponpage').val("false").trigger("change");
		} else {
			this.$el.find('.maponpage').val("true").trigger("change");
		}
	},
	toggleFullpage: function(e){
		if (e.target.value == "true"){
			this.$el.find('.fullpage').val("false").trigger("change");
		} else {
			this.$el.find('.fullpage').val("true").trigger("change");
		}
	},
	setLibrary: function(library){
		//extract name of library from select change event
		if (typeof library == 'object'){
			library = $(library.target).val();
		};
		this.model.set('library', library);

		//set map options
		var mapOptionsTemplate = _.template( $('#'+library+"-map-options-template").html() );
		this.$el.find('.map-options-inputs').html(mapOptionsTemplate({pagenum: this.model.get('pagenum')}));

		this.setInteractionOptions();
	},
	addDataLayer: function(){
		//add data layer options
		createLayer("dataLayer", 0);
		this.$el.find('.addDataLayer').hide();
	},
	render: function(){
		//create page div
		var pagenum = this.model.get('pagenum');
		this.$el.attr('id', 'page-'+pagenum);
		this.$el.html(this.template({pagenum: pagenum}));

		//add page div to page container
		$('#page-container').append(this.$el[0]);

		//add base layer options
		createLayer("baseLayer", 0);

		//set initial map options
		this.setLibrary('Leaflet');

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		//make remove button invisible if the first page
		var display = pagenum > 1 ? "inline-block" : "none";
		this.$el.children('.removepage').css('display', display);

		//hide interaction data layers divs
		this.$el.find('.interaction-dataLayers').hide();

		return this;
	}
});

var BaseLayerView = Backbone.View.extend({
	tagName: 'div',
	className: 'baseLayer',
	template: _.template( $('#baseLayer-template').html() ),
	events: {
		"click .removelayer": "removeLayer",
		"click .addlayer": "addLayer",
		"change .layer-source-select": "changeSourceType",
		"keyup .layerName": "addInteractionLayers"
	},
	i: 0,
	sourceLinks: {
		Leaflet: {
			link: "http://leaflet-extras.github.io/leaflet-providers/preview/",
			example: "http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png or Stamen.TonerLite"
		}
		//add other libraries...
	},
	removeLayer: function(){
		//reset layer numbering
		this.i--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			mapsection = $('#m-section-'+pagenum+'-map');
		this.$el.fadeOut(500, function(){
			view.remove();
			console.log(view.i+1);
			mapsection.find('.i-dataLayer-'+(view.i+1)).remove();
			//reveal data layer add button if last data layer removed
			if (mapsection.find('.'+view.className).length == 0){
				mapsection.find('.addDataLayer').show();
				//hide interaction data layers divs
				mapsection.find('.interaction-dataLayers').hide();
			};
			//reset numbering of layers once element has been removed
			var i = 0;
			mapsection.find('.'+view.className).each(function(){
				$(this).attr('id', 'page-'+pagenum+'-'+view.className+'-'+i);
				//replace any i character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var name = $(this).attr('name').replace(/\[[0-9]\]/g, '['+i+']');
						$(this).attr('name', name);
					}
				});
				i++;
			});
		});
	},
	addLayer: function(){
		createLayer(this.className, this.i+1);
	},
	changeSourceType: function(e){
		//dynamically change source type
		var view = this,
			sourceInput = this.$el.find('.layer-source-input'),
			layerstring = sourceInput.attr('name').split('.');
			layerstring = layerstring[0] + '.' + layerstring[1] + '.';
		if ($(e.target).val() == 'url'){
			sourceInput.attr({
				name: layerstring + 'source',
				placeholder: 'example: '+view.sourceUrlExample,
				class: 'layer-source-input fullwidth'
			});
		} else if ($(e.target).val() == 'postgis') {
			sourceInput.attr({
				name: layerstring + 'source-{postgis}',
				placeholder: 'table name',
				class: 'layer-source-input'
			});
		}
	},
	removeButton: function(){
		//make remove button invisible if the first layer
		var display = this.i > 0 ? "inline-block" : "none";
		this.$el.children('.removelayer').css('display', display);
	},
	addInteractionLayers: function(e){
		var pagenum = this.model.get('pagenum'),
			i = this.i,
			layerName = e.target.value,
			mapsection = $('#m-section-'+pagenum+'-map');

		var InteractionDataLayersModel = Backbone.Model.extend();

		var InteractionDataLayersView = Backbone.View.extend({
			tagName: 'div',
			template: _.template( $('#interaction-dataLayer-template').html() ),
			events: {
				'change input[type=checkbox]': "changeInput",
				'namechange span': "changeLayerName"
			},
			changeInput: function(e){
				var checked = e.target.checked,
					hiddenInput = this.$el.find('input[type=hidden]'),
					layerName = this.$el.find('.dataLayer-layerName').html();
				if (checked){
					hiddenInput.val(layerName);
				} else {
					hiddenInput.removeAttr('value');
				};
			},
			changeLayerName: function(e, layerName){
				this.$el.find('.dataLayer-layerName').html(layerName);
				this.changeInput({target: this.$el.find('input[type=checkbox]')[0]});
			},
			render: function(){
				this.$el.append(this.template(this.model.attributes));
				this.$el.attr('class', "interaction-dataLayer i-dataLayer-"+this.model.get('i'));
				mapsection.find('.'+this.model.get('interaction')+' .interaction-dataLayers').append(this.el);
			}
		})

		if (this.className == "dataLayer"){
			mapsection.find('.interaction-dataLayers').each(function(){
				$(this).show();
				var interaction = $(this).parent().attr('class').split(' ')[0];
				var interactionDataLayersModel = new InteractionDataLayersModel({
					i: i,
					layerName: e.target.value,
					interaction: interaction,
					pagenum: pagenum
				});
				if ($(this).find('.i-dataLayer-'+i).length == 0){
					var interactionDataLayersView = new InteractionDataLayersView({
						model: interactionDataLayersModel
					});
					interactionDataLayersView.render();
				} else {
					$(this).find('.i-dataLayer-'+i).find('span').trigger('namechange', [layerName]);
				};
			});
		};
	},
	setSourceLink: function(){
		//get library
		var library = this.model.get('library');
		//set placeholder
		this.sourceUrlExample = this.sourceLinks[library].example;
		//set source link
		this.$el.find('.sourcelink').attr('href', this.sourceLinks[library].link);
	},
	setLayerOptions: function(){
		//set layer options
		var library = this.model.get('library'),
			layerOptionsTemplate = _.template( $('#'+library+"-"+this.className+"-options-template").html() );
		this.$el.find('.layer-options-inputs').html(layerOptionsTemplate({pagenum: this.model.get('pagenum'), i: this.i}));

		this.setSourceLink();

		this.$el.find('.layer-source-input').attr('placeholder', 'ex: '+this.sourceUrlExample);
	},
	render: function(){
		//create layer div
		var pagenum = this.model.get('pagenum'),
			className = this.className;
		this.$el.attr({
			id: 'page-'+pagenum+'-'+this.className+'-'+this.i,
			class: className + ' subsection'
		});
		this.$el.html(this.template({pagenum: this.model.get('pagenum'), i: this.i}));
		
		this.setLayerOptions();

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		this.removeButton();

		//add layer div to page's baseLayers/dataLayers container
		$('#page-'+pagenum+' .'+this.className+'s').append(this.$el[0]);

		//add visualization techniques
		createTechnique(this.i, 0);

		return this;
	}
});

var DataLayerView = BaseLayerView.extend({
	className: 'dataLayer',
	template: _.template( $('#dataLayer-template').html() ),
	sourceLinks: {
		Leaflet: {
			link: "http://geojson.org/geojson-spec.html",
			example: "data/geography.geojson"
		}
		//add other libraries...
	},
	removeButton: function(){}
});

var TechniqueView = Backbone.View.extend({
	tagName: 'div',
	className: 'technique',
	template: _.template( $('#technique-template').html() ),
	events: {
		"click .removetechnique": "removeTechnique",
		"click .addtechnique": "addTechnique",
		"change .technique-type": "changeTechniqueType",
		"change .technique-classification": "changeClassification",
		"change .technique-n-classes": "changeNClasses",
		"change .technique-symbol": "changeSymbol"
	},
	i: 0,
	ii: 0,
	changeTechniqueType: function(techniqueType){
		//get value from event target
		if (typeof techniqueType == 'object'){
			techniqueType = techniqueType.target.value;
		};

		var l = this.$el,
			pagenum = this.model.get('pagenum'),
			i = this.i,
			ii = this.ii,
			changeClassification = this.changeClassification,
			changeNClasses = this.changeNClasses,
			changeSymbol = this.changeSymbol;

		//object to hold descriptions and form modification function for each technique type
		var techniques = {
			choropleth: {
				desc: "Colors geographic units according to data values in the expressed attribute. Data must have polygon or multipolygon geometries.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-classification-p').show().find('select').val('natural breaks');
					l.find('.technique-n-classes-p').show().find('select').val('5');
					l.find('.technique-symbol-p, .technique-interval-p, .technique-size-p').hide().find('input, select').attr('disabled', true);
					//add color scale to classes div
					var colorScaleTemplate = _.template( $('#color-scale-classes-template').html() );
					l.find('.technique-classes').html(colorScaleTemplate({pagenum: pagenum, i: i, ii: ii}));
					//call next method
					changeClassification('natural breaks', l, changeNClasses);
				}
			},
			'proportional symbol': {
				desc: "Adds a symbol (typically a circle) on top of each geographic unit and sizes the symbol according to data values in the expressed attribute. Data may have point or polygon/multipolygon geometries; if polygon/multipolygon, symbols will be placed at the centroid of each geographic unit.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-classification-p').show().find('select').val('unclassed');
					l.find('.technique-symbol-p').show().find('select').val('circle');
					l.find('.technique-interval-p, .technique-size-p').hide().find('input, select').attr('disabled', true);
					//add symbol radii to classes div
					var symbolRadiiTemplate = _.template( $('#radii-classes-template').html() );
					l.find('.technique-classes').html(symbolRadiiTemplate({pagenum: pagenum, i: i, ii: ii}));
					//call next methods
					changeClassification('unclassed', l, changeNClasses);
					changeSymbol('circle', l);
				}
			},
			dot: {
				desc: "Randomly places dots within each geographic unit, with the number of dots a ratio to the data values in the expressed attribute. Data must have polygon or multipolygon geometries.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-interval-p').show().find('input').val('10');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.interval-ratio').html('Dot ratio: 1:');
					l.find('.dot-line-size').html('Dot size: ');
				}
			},
			isarithmic: {
				desc: "Creates contour lines based on interpolation of data values in the expressed attribute, with the frequency of lines determined by the isarithm interval. Only the value of each line can be retrieved by the user.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-interval-p').show().find('input').val('10');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.interval-ratio').html('Line interval: ');
					l.find('.dot-line-size').html('Isarithm width: ');
				}
			},
			heat: {
				desc: "Creates a heatmap based on data values and distances between data points. The heatmap is a raster surface, so retrieve interactions are not available.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p, .technique-interval-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.dot-line-size').html('Point radius: ');
				}
			}
		};
		//implement form changes
		this.$el.find('.technique-type-desc').html(techniques[techniqueType].desc);
		techniques[techniqueType].modifyForm();

	},
	changeClassification: function(classification, l, changeNClasses){
		//get value from event target
		if (typeof classification == 'object'){
			classification = classification.target.value;
		};
		l = l || this.$el;
		changeNClasses = changeNClasses || this.changeNClasses;

		function modifyForm(){
			//revert to 5 classes and reset classification
			l.find('.technique-n-classes-p').show().find('select').val("5");
			changeNClasses("5", l);
		};

		//object to hold descriptions and form modifications for each classification type
		var classifications = {
			quantile: {
				desc: "Groups the expressed data into classes with an equal number of data values in each class.",
				modifyForm: modifyForm
			},
			'equal interval': {
				desc: "Groups the expressed data into classes each with an equal range of values (e.g., 0-10, 10-20, 20-30, etc.).",
				modifyForm: modifyForm
			},
			'natural breaks': {
				desc: "Uses the Cartesian k-means algorithm to minimize the statistical distances between data points within each class.",
				modifyForm: modifyForm
			},
			unclassed: {
				desc: "Interpolates an output value for each expressed data value based on that value's location on a scale between the minimum and maximum values.",
				modifyForm: function(){
					l.find('.technique-n-classes-p').hide().find('select').val("2");
					changeNClasses("2", l);
				}
			}
		};
		//implement form changes
		l.find('.classification-type-desc').html(classifications[classification].desc);
		classifications[classification].modifyForm();
	},
	changeNClasses: function(nClasses, l){
		//get value from event target
		if (typeof nClasses == 'object'){
			nClasses = nClasses.target.value;
		};
		l = l || this.$el;

		//implement type of classification
		if (l.find('.technique-type').val() == 'choropleth'){
			//clean out select options
			l.find('.color-classes').empty();
			//get templates
			var colorOptionTemplate = _.template( $('#color-scale-option-template').html() ),
				colorSwatchTemplate = _.template( $('#color-swatch-template').html() );
			//add options for each colorbrewer class
			_.each(colorbrewer, function(colors, colorcode){
				if (colors[parseInt(nClasses)] || nClasses == "2"){
					//assign colorBrewer array, code
					var val = colorcode+'.'+nClasses,
						max = parseInt(nClasses) > 8 ? parseInt(nClasses) : 8;
						colorArray = nClasses == '2' ? [colors[max][0], colors[max][max-1]] : colors[parseInt(nClasses)];
					//add option for the colorbrewer class
					l.find('.color-classes').append(colorOptionTemplate({colorcode: val}));
					//add swatches for each color in the class to the option
					_.each(colorArray, function(fillColor){
						l.find('option[value="'+val+'"]').append(colorSwatchTemplate({fillColor: fillColor}));
					});
				};
			});
		} else if (l.find('.technique-type').val() == 'proportional symbol'){
			//clean out radii inputs table
			l.find('.radii-classes').html('<td class="l-align">Symbol radii:</td>');
			l.find('.radii-minmax').html('<td></td>');
			//get templates
			var radiusTemplate = _.template( $('#symbol-radius-template').html() );
			//get i and ii
			var id = l.attr('id').split('-'),
				i = id[3],
				ii = id[5];
			//add input for each radius class
			for (var a=0; a<parseInt(nClasses); a++){
				l.find('.radii-classes').append(radiusTemplate({pagenum: this.model.get('pagenum'), i: i, ii: ii}));
				var cell;
				if (a == 0){
					cell = '<td class="l-align">min</td>';
				} else if (a == parseInt(nClasses)-1){
					cell = '<td class="l-align">max</td>';
				} else {
					cell = '<td></td>';
				};
				l.find('.radii-minmax').append(cell);
			}
		};
	},
	changeSymbol: function(symbol, l){
		//get value from event target
		if (typeof symbol == 'object'){
			symbol = symbol.target.value;
		};
		l = l || this.$el;

		if (l.find('.technique-symbol').val() == 'circle'){
			l.find('.technique-symbol-url').attr({
				type: 'hidden',
				value: 'circle'
			});
		} else {
			l.find('.technique-symbol-url').attr({
				type: 'text',
				value: '',
				placeholder: 'ex.: img/square.png'
			});
		};
	},
	removeTechnique: function(){
		//reset technique numbering
		this.ii--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			mapsection = $('#m-section-'+pagenum+'-map');
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of layers once element has been removed
			var ii = 0;
			mapsection.find('.technique').each(function(){
				$(this).attr('id', 'page-'+pagenum+'-dataLayer-'+view.i+'-technique-'+ii);
				//replace any ii character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var name = $(this).attr('name').replace(/\[[0-9]\](?![\s\S]*\[)/, '['+ii+']');
						$(this).attr('name', name);
					}
				});
				ii++;
			});
		});
	},
	addTechnique: function(){
		createTechnique(this.i, this.ii+1);
	},
	removeButton: function(){
		//make remove button invisible if the first layer
		var display = this.ii > 0 ? "inline-block" : "none";
		this.$el.children('.removetechnique').css('display', display);
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-dataLayer-'+this.i+'-technique-'+this.ii,
			class: 'technique subsection'
		});
		this.$el.html(this.template({pagenum: this.model.get('pagenum'), i: this.i, ii: this.ii}));

		this.removeButton();
		this.changeTechniqueType('choropleth');
		this.changeNClasses('5', this.$el);

		//add layer div to layer's techniques container
		$('#page-'+pagenum+'-dataLayer-'+this.i+' .layer-techniques').append(this.$el[0]);
		return this;
	}
});

var LayerViews = {
	baseLayer: BaseLayerView,
	dataLayer: DataLayerView
};

function createPage(pagenum){
	pageModel.set('pagenum', pagenum);
	var pageView = new PageView({model: pageModel});
	var page = pageView.render();
};

function createLayer(layerType, layerIndex){
	var layerView = new LayerViews[layerType]({model: pageModel});
	layerView.i = layerIndex;
	var layer = layerView.render();
};

function createTechnique(layerIndex, techniqueIndex){
	var techniqueView = new TechniqueView({model: pageModel});
	techniqueView.i = layerIndex;
	techniqueView.ii = techniqueIndex;
	var technique = techniqueView.render();
};

function createBooleanDropdown(select){
	//creates a yes-no dropdown menu
	var options = {
		yes: "true",
		no: "false"
	};
	if (select.html().length == 0){
		for (var option in options){
			select.append(optionTemplate({value: options[option], option: option}));
		};
		//determine which option should display by default
		if (select.attr('class').indexOf('no') > -1){
			select.val("false");
		};
		select.on('change', function(){
			var togglediv = $(this).closest('.q').children('.displayonyes, .hideonno');
			if ($(this).val() == "true"){
				togglediv.slideDown(100).find('input, textarea, select').removeAttr('disabled');
			} else {
				togglediv.slideUp(100).find('input, textarea, select').attr('disabled', true);
			}
		});
	};
	return select;
};

function processArrays(level){
	var levelArr = [], levelObj = {};
	//level is the object to be examined
	Object.keys(level).forEach(function(key){
		//if key is a number, level is an array
		if (!isNaN(parseInt(key))){
			//recursively sift through all levels of object
			if (typeof level[key] == 'object'){
				levelArr.push(processArrays(level[key]));
			} else {
				//just a simple array value
				levelArr.push(level[key]);
			};
		} else {
			var complexKey = key.split('-{');
			if (complexKey.length > 1){
				var subkey = complexKey[0],
					variable = complexKey[1].substring(0,complexKey[1].length-1);
				//deal with custom properties array
				if (variable == '[]'){
					//make array if not exists
					if (!levelObj.hasOwnProperty(subkey)){
						levelObj[subkey] = []
					};
					//add all values to array
					level[key] = level[key].split(',');
					level[key].forEach(function(arrVal){
						levelObj[subkey].push(arrVal.trim());
					});
				} else if (variable == '{}'){
					//make object if not exists, then merge
					if (!levelObj.hasOwnProperty(subkey)){
						levelObj[subkey] = {}
					};
					$.extend(levelObj[subkey], level[key]);
				};
			} else if (typeof level[key] == 'object'){
				//recursively sift through all levels of object
				levelObj[key] = processArrays(level[key]);
			} else {
				//just a simple key-value pair
				levelObj[key] = level[key];
			};
		};
	});
	//return correct data structure
	if (levelArr.length > 0){
		return levelArr;
	} else {
		return levelObj;
	};
};

function processForm(data){
	var inners = {};
	_.each(data, function(inData){
		var propArray = inData.name.split('.');
		//create pseudo-nested object strings
		var len = propArray.length,
			open = '',
			close = '',
			value = inData.value;
		for (var i = 0; i < len; i++){
			open += '{"' + propArray[i] + '":';
			close += '}';
			if (i == len-1){
				//determine how to treat value
				if (value[0] == '{' || value[0] == '[' || (value != '' && !isNaN(Number(value)))){
					open += value;
				} else {
					open += '"' + value + '"';
				}
			};
		};
		var tempObj = open + close;
		//zip up the objects
		$.extend(true, inners, JSON.parse(tempObj));
	});

	inners = processArrays(inners);
	return inners;
};

function readForm(step){
	var data = $('#'+step).serializeArray();

	if (step == 'pages'){
		var outer = processForm(data);
		allData['mpages'] = outer.map;
		allData['qpages'] = outer.questions;
	} else {
		allData[step] = processForm(data);
		console.log(step, allData);
	}
};

function changeStep(prevStep, currentStep){
	//process form data
	readForm(prevStep);

	$('#'+prevStep).fadeOut(500, function(){
		$(window).scrollTop(0);
		$('#'+currentStep).fadeIn(500);
	});

	//add html for first page if first pass at Step 2 (pages)
	if (currentStep == "pages" && $('#page-container').html().length == 0){
		createPage(1);
	};
};

function navigation(){
	//activate navigation buttons
	var step = 0,
		steps = [
			"interface",
			"pages",
			"conditions",
			"server",
			"finished"
		];

	//show only the current step on page
	$('.step').each(function(){
		if ($(this).attr('id') != steps[step]){
			$(this).hide();
		};
	})

	//go to the next step on advance
	$('button[name=next]').click(function(){
		prevStep = steps[step];
		step++;
		changeStep(prevStep, steps[step]);
	});

	//go to previous step on back
	$('button[name=back]').click(function(){
		prevStep = steps[step];
		step--;
		changeStep(prevStep, steps[step]);
	});
};

function initialize(){
	$('.displayonyes').hide();

	navigation();

	$('.bdd').each(function(){
		createBooleanDropdown($(this));
	});

	//add sticky header
	$('body').scroll(function(){
		if ($(this).scrollTop() > 10){
			$('header').addClass("sticky");
			$('.header-button').slideDown(400);
		} else {
			$('header').removeClass("sticky");
			$('.header-button').slideUp(0);
		}
	})
};

$(document).ready(initialize);

})();
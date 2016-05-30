(function(){

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
	setLibrary: function(library){
		//extract name of library from select change event
		if (typeof library == 'object'){
			library = $(library.target).val();
		};
		this.model.set('library', library);

		//set map options
		var mapOptionsTemplate = _.template( $('#'+library+"-map-options-template").html() );
		this.$el.find('.map-options-inputs').html(mapOptionsTemplate());
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

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		//set initial map options
		this.setLibrary('Leaflet');

		//make remove button invisible if the first page
		var display = pagenum > 1 ? "inline-block" : "none";
		this.$el.children('.removepage').css('display', display);

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
		"change .layer-source-select": "changeSourceType"
	},
	i: 0,
	sourceUrlExample: "http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png",
	removeLayer: function(){
		//reset layer numbering
		this.i--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			mapsection = $('#m-section-'+pagenum+'-map');
		this.$el.fadeOut(500, function(){
			view.remove();
			//reveal data layer add button if last data layer removed
			if (mapsection.find('.'+view.className).length == 0){
				mapsection.find('.addDataLayer').show();
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
			sourceInput = this.$el.find('.layer-source-input');
		if ($(e.target).val() == 'url'){
			sourceInput.attr({
				name: 'source-{url}',
				placeholder: 'example: '+view.sourceUrlExample,
				class: 'layer-source-input fullwidth'
			});
		} else if ($(e.target).val() == 'postgis') {
			sourceInput.attr({
				name: 'source-postgis:{tablename}',
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
	render: function(){
		//create layer div
		var pagenum = this.model.get('pagenum');
		this.$el.attr('id', 'page-'+pagenum+'-'+this.className+'-'+this.i);
		this.$el.html(this.template({i: this.i}));
		
		//set layer options
		var library = this.model.get('library'),
			layerOptionsTemplate = _.template( $('#'+library+"-"+this.className+"-options-template").html() );
		this.$el.find('.layer-options-inputs').html(layerOptionsTemplate({i: this.i}));

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		this.removeButton();

		//add layer div to page's baseLayers/dataLayers container
		$('#page-'+pagenum+' .'+this.className+'s').append(this.$el[0]);
		return this;
	}
});

var DataLayerView = BaseLayerView.extend({
	className: 'dataLayer',
	template: _.template( $('#dataLayer-template').html() ),
	sourceUrlExample: "data/geography.geojson",
	removeButton: function(){}
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
			if ($(this).val() == "true"){
				$(this).closest('.q').children('.displayonyes, .hideonno').slideDown(100);
			} else {
				$(this).closest('.q').children('.displayonyes, .hideonno').slideUp(100);
			}
		});
	};
	return select;
};

function changeStep(prevStep, currentStep){
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

	//preview uploaded images
	$('.image-upload').change(function(){
		var input = this,
			preview = $(input).parent().find('.preview');
		if (input.files && input.files[0]){
			var reader = new FileReader();
			reader.onload = function(e){
				preview.attr('src', e.target.result);
			};
			reader.readAsDataURL(input.files[0]);
		};
		//add remove button
		var remove = $('<img src="../img/remove.png" class="remove-button" title="remove">');
		$(input).parent().append(remove);
		remove.click(function(){
			$(input).val("");
			remove.remove();
			preview.attr('src', '../img/blankimage.png');
		});
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
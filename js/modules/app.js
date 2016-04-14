//main application script

var pid = Math.round(Math.random() * 1000000000),
	_pages = [],
	_pagesi = 0,
	_page = 0,
	_set = 0, 
	_block = 0;

_.extend(document, Backbone.Events);

(function(){

/******************* styles *********************/

	//view for each page section
	var Section = Backbone.View.extend({
		initialize: function(){
			this.$el.css(this.model.get('cssAttributes'));
			var logoUrl = this.model.get('logo-url');
			if (logoUrl !== undefined && logoUrl.length > 0){
				this.$el.children('img').attr('src', logoUrl);
			};
			this.$el.children('.content').html(this.model.get('content'));
		}
	});

	//models for section styles
	var SectionStyle = Backbone.Model.extend({
		defaults: {
			sectionId: ''
		}
	});

	//collection of styles retrieved from styles.json
	var Styles = Backbone.Collection.extend({
		model: SectionStyle,
		url: 'config/styles.json',
		setSections: function(){
			_.each(this.models, function(model){
				var section = new Section({
					model: model,
					el: '#' + model.get('sectionId')
				});
			});
			$(window).trigger("resize");
			$('#cover').fadeOut(250);
		},
		initialize: function(){
			this.on('sync', this.setSections);
		}
	});

	//get styles from styles.json
	var styles = new Styles();
	styles.fetch();

/******************* conditions *********************/

	//model for each test condition
	var Condition = Backbone.Model.extend({
		defaults: {
			pages: [],
			weight: -1,
			randomOrder: false
		}
	});

	//collection of conditions retrieved from conditions.json
	var Conditions = Backbone.Collection.extend({
		model: Condition,
		url: 'config/conditions.json',
		setCondition: function(model){
			if (model.get('pages').length > 0){
				_pages = model.get('pages');
			} else {
				//if pages is an empty array, fetch all pages
				$.ajax({
					dataType: "json",
					url: 'config/questions.json',
					async: false,
					success: function(questions){
						for (var i=0; i<questions.pages.length; i++){
							_pages.push(i+1);
						};
					}
				});
			};
			if (model.get('randomOrder')){
				//if nested, shuffle only inner arrays; otherwise shuffle all pages
				var pages = [], nested = false;
				_pages.forEach(function(page){
					if (typeof page == 'object'){
						page = _.shuffle(page);
						nested = true;
					};
					pages.push(page);
				});
				_pages = nested ? _.flatten(pages) : _.shuffle(pages);
			};
			//set new page
			_page = _pages[0]-1;
		},
		chooseCondition: function(){
			var choiceMin = 0,
				choiceMax = this.models.length,
				random = Math.random();
			_.each(this.models, function(model, i){
				if (model.get('weight') > -1){
					choiceMin = choiceMax < this.models.length ? choiceMax : 0;
					choiceMax = choiceMin == 0 ? model.get('weight') : choiceMin + model.get('weight');
				} else {
					choiceMin = i/this.models.length;
					choiceMax = (i+1)/this.models.length;
				};
				if (choiceMin < random && choiceMax >= random){
					this.setCondition(model);
				};
			}, this);
		},
		initialize: function(){
			this.on('sync', this.chooseCondition);
		}
	});

	//get conditions from conditions.json
	var conditions = new Conditions();
	conditions.fetch();

/***************** document resize ******************/

	//dynamic element sizes
	$(window).resize(function(){
		$("#container").css({
			//		whatever this is   -  5em for header + footer
			height: $(window).height() - (5/3 * $("#header").height())
		})
		$("#footer").css({
			width: $("#header").width(),
			height: "2em"
		});
		$("#m").css({
			//		whatever this is		 -	7em for header + footer + padding
			height: $("#container").height() - (7/3 * $("#header").height())
		});
		$("#map").css({
			height: $("#m").height()
		})
	});
})();
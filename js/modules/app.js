//main application script

var pid = Math.round(Math.random() * 1000000000),
	_pages = [],
	_pagesi = 0,
	_page = 0,
	_set = 0, 
	_block = 0,
	//_config variable enables live preview from setup app
	_config = window.location.search ? "setup/"+window.location.search.split('=')[1] : "config";

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
		url: _config+'/styles.json',
		setSections: function(){
			_.each(this.models, function(model){
				var section = new Section({
					model: model,
					el: '#' + model.get('sectionId')
				});
			});
			$(window).trigger("resize");
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
		url: _config+'/conditions.json',
		setCondition: function(model){
			if (model.get('pages').length > 0){
				_pages = model.get('pages');
			} else {
				//if pages is an empty array, fetch all pages
				$.ajax({
					dataType: "json",
					url: _config+'/questions.json',
					async: false,
					success: function(questions){
						for (var i=0; i<questions.pages.length; i++){
							_pages.push(i+1);
						};
					}
				});
			};

			var pages = [];
			_pages.forEach(function(page){
				if (typeof page == 'object'){
					//randomly shuffle inner arrays
					page = _.shuffle(page);
				};
				pages.push(page);
			});
			_pages = _.flatten(pages);
			//set new page
			_page = _pages[0]-1;
			//trigger map and question loading
			document.trigger('init');
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
		noConditions: function(){
			var PageModel = Backbone.Model.extend();
			this.models.push(new PageModel({pages: []}));
			this.chooseCondition();
		},
		initialize: function(){
			this.on('sync', this.chooseCondition);
			this.on('error', this.noConditions);
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
		});
		$("#header h1, .timer").css({ 'font-size': '' });
		["1em", "0.7em"].forEach(function(h){
			["#header h1", "#set-timer", "#page-timer"].forEach(function(s){
				if ($(s).height() > $("#header").height()){
					$(s).css({
						'font-size': h
					});
				};
				var mw = s.indexOf('timer') > -1 ? Math.abs($('#header').width() - $('#header h1').width() - $('#header img').width() - 50) + 'px' : '';
				$(s).css({
					padding: String(($("#header").height()-$(s).height())/2) + "px 0",
					'max-width': mw
				});
			});
		});
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
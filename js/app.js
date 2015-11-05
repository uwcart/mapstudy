//main application script

(function(){
	//view for each page section
	var Section = Backbone.View.extend({
		initialize: function(){
			this.$el.css(this.model.get('cssAttributes'));
			this.$el.children('img').attr('src', this.model.get('logo-url'));
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

	//dynamic styles
	$(window).resize(function(){
		$("#footer").css({
			width: $("#header").width(),
			height: "1.5em"
		});
		$("#m").css({
			height: $("#container").height() - (2* $("#header").height())
		});
	});
})();
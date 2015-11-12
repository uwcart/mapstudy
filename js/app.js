//main application script

(function(){
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
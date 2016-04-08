//Questions panel
(function(){

// $('#q').html('<button type="button" id="nextpage">Next page!</button>');
// $('#nextpage').click(function(){
// 	document.trigger('>>');
// })

var _options = {}, _page = 0, _set = 0, _block = 0;

/*************** answer inputs *****************/

var InputModel = Backbone.Model.extend({
	defaults: {
		"required": false,
		"type": "text",
		"label": "foobar",
		"options": [],
		"items": []
	}
});

var TextInputView = Backbone.View.extend({
	template: _.template( $('#text-input-template').html() ),
	required: function(){
		if (this.model.get('required')){
			this.$el.find('.ask').before('<a class="required">*</a>');
		};
	},
	render: function(){
		this.$el.append(this.template({label: this.model.get('label')}));
		this.required();
	}
});

var ParagraphInputView = TextInputView.extend({
	template: _.template( $('#paragraph-input-template').html() ),
	render: function(){
		this.$el.append(this.template({label: this.model.get('label')}));
		this.required();
	}
});

var CheckboxesInputView = TextInputView.extend({
	template: _.template( $('#checkbox-input-template').html() ),
	appendItem: function(item, i){
		//get or create item label
		var label = item.hasOwnProperty('label') && item.label.length > 0 ? item.label.substring(0,20) : this.model.get('label')+"i"+i;
		//append item input
		this.$el.append(this.template({
			label: label,
			text: item.text
		}));
	},
	render: function(){
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		this.required();
	}
});

var RadiosInputView = CheckboxesInputView.extend({
	template: _.template( $('#radio-input-template').html() ),
	appendInputDiv: function(option,i){
		var inputDivTemplate = _.template( $('#input-div-template').html() );
		this.$el.append(inputDivTemplate({className: String(i)}));
	},
	appendOption: function(option, i, label){
		option.value = option.hasOwnProperty('value') && option.value.length > 0 ? option.value : option.text;
		label = label || this.model.get('label');
		this.$el.find('.input.'+i).append(this.template({
			label: label,
			text: option.text,
			value: option.value
		}));
	},
	appendOptionText: function(option,i){
		this.$el.find('.input.'+i).append(option.text);
	},
	render: function(){
		var options = this.model.get('options');
		_.each(options, function(option, i){
			this.appendInputDiv(option, i);
			this.appendOption(option, i);
			this.appendOptionText(option, i);
		}, this);
		this.required();
	}
});

var DropdownInputView = RadiosInputView.extend({
	template: _.template( $('#dropdown-input-template').html() ),
	render: function(){
		//append select element
		var className = '',
			selectTemplate = _.template( $('#dropdown-select-template').html() );
		for (var i=0; i<options.length; i++){
			className += ' ' + i;
		};
		this.$el.append(selectTemplate({
			className: className,
			label: this.model.get('label')
		}));
		//append options to select
		var options = this.model.get('options');
		_.each(options, this.appendOption, this);
		this.required();
	}
});

var MatrixInputView = RadiosInputView.extend({
	template: _.template( $('#matrix-input-template').html() ),
	appendOptionText: function(option){
		//append the header row
		var optionTextTemplate = _.template( $('#matrix-option-text-template').html() );
		this.$el.find('tr').append(optionTextTemplate({text: option.text}));
	},
	appendItem: function(item, i){
		var itemTextTemplate = _.template( $('#matrix-item-text-template').html() );
		//append row for item
		this.$el.find('table').append(itemTextTemplate({
			className: i,
			text: item.text
		}));
		//get or create item label
		var label = item.hasOwnProperty('label') && item.label.length > 0 ? item.label.substring(0,20) : this.model.get('label')+"i"+i;
		//append each option input
		var options = this.model.get('options');
		_.each(options, function(option){
			this.appendOption(option, i, label);
		}, this);
	},
	render: function(){
		//append table to block div
		var tableTemplate = _.template( $('#matrix-table-template').html() );
		this.$el.append(tableTemplate({label: this.model.get('label')}));
		var options = this.model.get('options'),
			items = this.model.get('items');
		//append header row of options
		_.each(options, this.appendOptionText, this);
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		this.required();
	}
});

var RankInputView = TextInputView.extend({

});

var InputViews = {
	text: TextInputView,
	paragraph: ParagraphInputView,
	checkboxes: CheckboxesInputView,
	radios: RadiosInputView,
	dropdown: DropdownInputView,
	matrix: MatrixInputView,
	rank: RankInputView
};

/************** question blocks ****************/

var BlockModel = Backbone.Model.extend({
	defaults: {
		"label": "",
		"title": "",
		"ask": "",
		"description": "",
		"input": {}
	}
});

var BlockView = Backbone.View.extend({
	tagName: 'div',
	setLabel: function(){
		return "p"+_page+"s"+_set+"b"+_block;
	},
	render: function(){
		//create label if none
		if (this.model.get('label').length == 0){
			this.model.set('label', this.setLabel());
		} else {
			this.model.set('label', this.model.get('label').substring(0, 20));
		};
		//assign label to div classname
		this.$el.attr('class', 'block '+this.model.get('label'));
		//set title
		if (this.model.get('title').length > 0){
			this.$el.append('<h3 class="title">'+ this.model.get('title') +'</h3>');
		};
		//set ask
		this.$el.append('<p class="ask">'+ this.model.get('ask') +'</p>');
		//set description
		if (this.model.get('description').length > 0){
			this.$el.append('<p class="description">'+ this.model.get('description') +'</p>');
		};
		//set input
		if (this.model.get('input').hasOwnProperty('type')){
			var inputModel = new InputModel(this.model.get('input'));
			inputModel.set('label', this.model.get('label'));
			var inputView = new InputViews[inputModel.get('type')]({
				el: this.el,
				model: inputModel
			});
			inputView.render();
		};
		$('#q').append(this.$el);
	}
});

/***************** questions *******************/

var Questions = Backbone.View.extend({
	el: '#q',
	events: {
		'click .next': 'next',
		'click .back': 'back',
		'click .save': 'save',
		'click .submit': 'submit'
	},
	resize: function(view){
		view.$el.css('max-height', $('#m').height());
		if (view.model.attributes.fullpage){
			$('#m').hide();
			view.$el.css('width', '2em');
			var w = view.$el.width();
			view.$el.css('width', $('#container').width() - w);
		} else {
			view.$el.css('width', '4em');
			var w = view.$el.width();
			var qWidth = $('#header').width() - $('#m').width() - w - 15;
			view.$el.css('width', qWidth);
		}
	},
	initialize: function(){
		//reset question set counter
		_set = 0;
		this.$el.empty();
		this.resize(this);
		var view = this;
		$(window).resize(function(){
			view.resize(view);
		});
	},
	renderBlock: function(block, i){
		_block = i;
		var blockModel = new BlockModel(block);
		var blockView = new BlockView({model: blockModel});
		blockView.render();
	},
	render: function(){
		var qset = this.model.get('sets')[_set];
		_.each(qset.blocks, this.renderBlock, this);
	},
	addData: function(input){
		_options.attributes.data[input.name] = input.value;
	},
	record: function(){
		var inputs = this.$el.serializeArray();
		_.each(inputs, this.addData, this);
	},
	next: function(){
		//record data for the current set
		this.record();
		//render the next set or page
		_set++;
		if (_set < this.model.get('sets').length){
			this.render();
		} else {
			document.trigger('>>');
		};
	},
	back: function(){
		//record data for the current set
		this.record();
		//render the previous set or page
		_set--;
		if (_set > -1){
			this.render();
		} else {
			document.trigger('<<');
		};
	},
	save: function(){
		//save data to database and alert user to their anonymous user id
	},
	submit: function(){
		//send all data to server for database or e-mail to admin

		//go to next page
		document.trigger('>>');
	}
});

/*************** set questions *****************/

function setQuestions(options){
	//set global _options variable to config model
	_options = options || _options;
	//add data object to hold all recorded data
	_options.set('data', {
		userId: Math.round(Math.random() * 1000000000)
	});
	//load new questions for the current page
	var Page = Backbone.DeepModel.extend(),
		page = new Page(_options.get('pages')[_page]);
	var questions = new Questions({model: page});
	questions.render();
};

/************** questions config **************/

var QuestionsConfig = Backbone.DeepModel.extend({
	url: "config/questions.json"
});
//get questions configuration options
var qConfig = new QuestionsConfig();
qConfig.on('sync', setQuestions);
qConfig.fetch();

//trigger next page
document.on('>>', function(){
	_page++;
	if (_options.attributes.hasOwnProperty("pages") && _options.get('pages').length > _page){
		setQuestions();
	};
});

})();
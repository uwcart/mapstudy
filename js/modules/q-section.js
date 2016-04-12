//Questions panel
(function(){

// $('#q').html('<button type="button" id="nextpage">Next page!</button>');
// $('#nextpage').click(function(){
// 	document.trigger('>>');
// })

var _options = {};

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
		//assign any value stored in _options data

	}
});

var ParagraphInputView = TextInputView.extend({
	template: _.template( $('#paragraph-input-template').html() )
});

var CheckboxesInputView = TextInputView.extend({
	template: _.template( $('#checkbox-input-template').html() ),
	appendItem: function(item, i){
		//get or create item label
		var label = item.hasOwnProperty('label') && item.label.length > 0 ? item.label.substring(0,20) : this.model.get('label')+"i"+(i+1);
		//append item input
		this.$el.find('.input').append(this.template({
			label: label,
			text: item.text,
			value: i+1
		}));
	},
	render: function(){
		this.$el.append('<div class="input">');
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		this.required();
		//assign any values stored in _options data
		
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
		//assign any values stored in _options data
		
	}
});

var DropdownInputView = RadiosInputView.extend({
	template: _.template( $('#dropdown-input-template').html() ),
	render: function(){
		var className = '',
			selectTemplate = _.template( $('#dropdown-select-template').html() ),
			options = this.model.get('options');
		for (var i=0; i<options.length; i++){
			className += ' ' + i;
		};
		//append select element
		this.$el.append(selectTemplate({
			className: className,
			label: this.model.get('label')
		}));
		//append options to select
		_.each(options, this.appendOption, this);
		this.required();
		//assign any values stored in _options data
		
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
		var label = item.hasOwnProperty('label') && item.label.length > 0 ? item.label.substring(0,20) : this.model.get('label')+"i"+(i+1);
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
		//assign any values stored in _options data
		
	}
});

var RankInputView = CheckboxesInputView.extend({
	template: _.template( $('#rank-input-template').html() ),
	events: {
		"sortstop .input": "resort"
	},
	resort: function(){
		var items = this.$el.find('.rank-item');
		items.sort(function(a, b){
			return $(a).offset().top > $(b).offset().top;
		});
		_.each(items, function(item, i){
			$(item).find('.value').text(String(i+1));
			$(item).find('input').val(String(i+1));
		});
	},
	render: function(){
		this.$el.append('<div class="input">');
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		//make input sortable
		this.$el.find('.input').sortable({
			axis: "y",
			containment: "parent"
		});
		//sort listener rearranges values
		this.required();
	}
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
		return "p"+(_page+1)+"s"+(_set+1)+"b"+(_block+1);
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
		$('#q form').append(this.$el);
	}
});

/****************** buttons ********************/

var ButtonModel = Backbone.Model.extend({
	initialize: function(){
		var buttonName = this.get('buttonName'),
			buttonCap = buttonName.substring(0,1).toUpperCase() + buttonName.substring(1);
		this.set('buttonCap', buttonCap);
	}
});

var ButtonView = Backbone.View.extend({
	el: '.buttons',
	template: _.template( $('#questions-button-template').html() ),
	render: function(){
		this.$el.append(this.template(this.model.attributes));
	}
});

/******************** data *********************/

var Data = Backbone.Model.extend({
	url: 'php/data.php',
	record: function(){
		var date = new Date();
		this.set('updatetime', date.toUTCString());
		this.save();
	},
	initialize: function(){
		this.record();
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
	renderButton: function(button){
		var buttonModel = new ButtonModel({buttonName: button});
		var buttonView = new ButtonView({model: buttonModel});
		buttonView.render();
	},
	renderButtons: function(buttons){
		//append div for buttons
		this.$el.append('<div class="buttons"></div>');
		//sort buttons to be added
		var order = {
			back: 0,
			next: 1,
			save: 2,
			submit: 3
		};
		buttons.sort(function(a,b){	return order[a] - order[b];	});
		//add each button
		_.each(buttons, this.renderButton, this);
	},
	render: function(){
		//erase current contents of questions section
		this.$el.empty().append('<form>');
		//get current set
		var qset = this.model.get('sets')[_set];
		//render blocks
		_.each(qset.blocks, this.renderBlock, this);
		//assign any values stored in data
		var data = _options.get('data');
		for (var label in data){
			this.$el.find('input[type=text][name="'+label+'"], input[type=hidden][name="'+label+'"], textarea[name="'+label+'"], select[name="'+label+'"]').val(data[label]);
			this.$el.find('input[type=checkbox][name="'+label+'"][value="'+data[label]+'"], input[type=radio][name="'+label+'"][value="'+data[label]+'"]').attr('checked', 'checked');
		};
		//re-sort rank inputs
		$('.ui-sortable').each(function(){
			var items = [], sortable = $(this);
			sortable.children('.rank-item').each(function(){
				var val = $(this).children('input').val();
				$(this).children('.value').text(val);
				var item = {
					val: val,
					el: $(this)
				};
				items.push(item);
			});
			sortable.children('.rank-item').remove();
			items.sort(function (a, b){
				return a.val > b.val;
			});
			items.forEach(function(item){
				sortable.append(item.el[0]);
			});
		});
		//render buttons
		this.renderButtons(qset.buttons);
	},
	addData: function(input){
		_options.attributes.data[input.name] = input.value;
	},
	validate: function(){
		var go = true;
		$('.required').each(function(){
			var required = $(this).parent(),
				inputSet = required.find('input[type=checkbox], input[type=radio]'),
				textbox = required.find('input[type=text]'),
				textarea = required.find('textarea'),
				select = required.find('select'),
				inputNames = [];
			//take care of checked inputs first
			inputSet.each(function(){
				inputNames.push($(this).attr('name'));
			});
			inputNames = _.uniq(inputNames);
			inputNames.forEach(function(name){
				if (required.find('input[name='+name+']:checked').length == 0){ go = false };
			});
			//test for text in text fields and for dropdown value
			if (textbox.length > 0 && textbox.val().length == 0){ go = false };
			if (textarea.length > 0 && textarea.val().length == 0){ go = false };
			if (select.length > 0 && select.val().length == 0){go = false};
		});
		return go;
	},
	record: function(){
		//get all input values in set
		var inputs = this.$el.find('form').serializeArray();
		//check for required answers
		if (this.validate()){
			_.each(inputs, this.addData, this);
		} else {
			alert("Please answer all of the required questions (marked with a red star).");
			return false;
		};
		//record data
		var dataModel = new Data(_options.get('data'));
		return true;
	},
	next: function(){
		//record data for the current set
		if (this.record('set')){
			//render the next set or page
			_set++;
			if (_set < this.model.get('sets').length){
				this.render();
			} else {
				document.trigger('>>');
			};
		};
	},
	back: function(){
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
		this.record('save');
	},
	submit: function(){
		//send all data to server for database or e-mail to admin
		if (this.record('submit')){
			document.trigger('>>');
		};
	}
});

/*************** set questions *****************/

function setQuestions(options){
	//set global _options variable to config model
	_options = options || _options;
	//add data object to hold all recorded data
	_options.set('data', {
		pid: pid
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
//Questions panel
(function(){

var _options = {},
	questions;

/*************** answer inputs *****************/

var InputModel = Backbone.Model.extend({
	defaults: {
		"required": false,
		"autoadvance": false,
		"type": "text",
		"label": "foobar",
		"options": [],
		"items": []
	}
});

var TextInputView = Backbone.View.extend({
	template: _.template( $('#text-input-template').html() ),
	required: function(){
		if (this.model.get('required') || this.model.get('autoadvance')){
			this.$el.find('.ask').before('<a class="required">*</a>');
		};
	},
	render: function(){
		this.$el.append(this.template({label: this.model.get('label')}));
		this.required();
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
		this.$el.find('.input-items').append(this.template({
			label: label,
			text: item.text,
			value: i+1
		}));
	},
	render: function(){
		this.$el.append('<div class="input-items">');
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		this.required();
		this.$el.find('input').click(function(){
			if (!$(this).is(':checked')){
				_options.attributes.data[$(this).attr('name')] = {
					value: '',
					tmsp: Date.now()
				};
			};			
		});
	}
});

var RadiosInputView = CheckboxesInputView.extend({
	template: _.template( $('#radio-input-template').html() ),
	events: {
		'change .input:last input[type=radio]': 'autoadvance'
	},
	appendInputDiv: function(option,i){
		var inputDivTemplate = _.template( $('#input-div-template').html() );
		this.$el.find('.radio-input').append(inputDivTemplate({className: String(i)}));
	},
	appendOption: function(option, i, label){
		option.value = option.hasOwnProperty('value') && option.value.length > 0 ? option.value : option.text;
		label = label || this.model.get('label');
		this.$el.find('.input-item.'+i).append(this.template({
			label: label,
			text: option.text,
			value: option.value
		}));
	},
	appendOptionText: function(option,i){
		this.$el.find('.input-item.'+i).append(option.text);
	},
	autoadvance: function(e){
		if (this.model.get('autoadvance')){
			window.setTimeout(function(){
				document.trigger('nextset');
			}, 100);
		};
	},
	render: function(){
		this.$el.append('<div class="input radio-input">');
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
	events: {
		'change select': 'autoadvance'
	},
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
		this.$el.find('span.'+label).html(item.text);
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
		this.$el.append('<div class="input-items input">');
		var items = this.model.get('items');
		_.each(items, this.appendItem, this);
		//make input sortable
		this.$el.find('.input-items').sortable({
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
		"video": "",
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
		//set video
		if (this.model.get('video').length > 0){
			var video = this.model.get('video'),
				template = video.indexOf('http') > -1 ? _.template( $('#iframe-template').html() ) : _.template( $('#video-template').html() ),
				width = $("#q").width(),
				height = width * 9 / 16;
			this.$el.append(template({
				width: width,
				height: height,
				source: video 
			}));
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
		//hack to fix video sizing issue--no idea why this only works with pre-set width and height
		var w = $('#q form').width();
		$('video, iframe').attr({
			width: w,
			height: w * 9 / 16
		});
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

/******************* timer *********************/

var TimerModel = Backbone.Model.extend({
	defaults: {
		level: 'set',
		direction: 'up',
		starttime: '00:00:00',
		persist: false,
		remove: false
	}
});

var TimerView = Backbone.View.extend({
	interval: function(view){
		//get starting time
		var st = view.$el.html().split(':'),
			h = parseInt(st[0]),
			m = parseInt(st[1]),
			s = parseInt(st[2]),
			nt = '';
		if (view.model.get('direction') == 'up'){
			//count up
			if (s < 59){
				s++;
			} else {
				s = 0;
				if (m < 59){
					m++;
				} else {
					m = 0;
					if (h < 99){
						h++
					} else {
						h = 0;
					};
				};
			};	
		} else {
			//count down
			if (s > 0){
				s--;
			} else {
				s = 59;
				if (m > 0){
					m--;
				} else {
					m = 59;
					if (h > 0){
						h--;
					} else {
						h = 99;
					}
				}
			}
		};
		//if countdown gets to 0, trigger next
		if (h == 99){
			view.removeTimer();
			view.model.get('level') == "page" ? document.trigger('>>') : document.trigger('nextset');
			return false;
		};
		//set new time
		[h, m, s].forEach(function(d, i){
			nt += d < 10 ? '0' + String(d) : String(d);
			nt += i < 2 ? ':' : '';
		});
		view.$el.html(nt);
	},
	removeTimer: function(){
		var level = this.model.get('level');
		if (document.hasOwnProperty(level+'Timer')){
			window.clearInterval(document[level+'Timer']);
			delete document[level+'Timer'];
		};
		this.$el.empty();
	},
	setTimer: function(){
		var level = this.model.get('level'),
			view = this;
		this.$el.html(this.model.get('starttime'));
		document[level+'Timer'] = window.setInterval(function(){
			view.interval(view);
		}, 1000);

		//remove timer on next or back if not persistent
		if (level == 'set' && !this.model.get('persist')){
			document.once('set>> set<< >> <<', this.removeTimer, this);
		} else if (!this.model.get('persist')){
			document.once('>> <<', this.removeTimer, this);
		};
	},
	render: function(){
		//clear any previous timers
		this.removeTimer();
		//set new timer unless instructed otherwise
		if (!this.model.get('remove')){
			this.setTimer();
		};
	},
	initialize: function(){
		this.setElement('#'+this.model.get('level')+'-timer');
	}
});

/******************** data *********************/

var Data = Backbone.Model.extend({
	url: 'php/data.php',
	record: function(action){
		this.set('action', action);
		var date = new Date();
		this.set('updatetime', {
			name: 'updatetime',
		 	value: date.toUTCString()
		});
		this.save();
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
		//reset map if specified
		if (qset.hasOwnProperty('resetMap') && qset.resetMap){
			$('.reset-control').trigger('click');
		};
		//render blocks
		_.each(qset.blocks, this.renderBlock, this);
		//assign any values stored in data
		var data = _options.get('data');
		_.each(data, function(d){
			this.$el.find('input[type=text][name="'+d.name+'"], input[type=hidden][name="'+d.name+'"], textarea[name="'+d.name+'"], select[name="'+d.name+'"]').val(d.value);
			this.$el.find('input[type=checkbox][name="'+d.name+'"][value="'+d.value+'"], input[type=radio][name="'+d.name+'"][value="'+d.value+'"]').attr('checked', 'checked');
		}, this);
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
		if (qset.hasOwnProperty('buttons') && qset.buttons.length > 0){
			this.renderButtons(qset.buttons);
		};
		//set timer
		if (qset.hasOwnProperty('timer')){
			var timerOptions = _.extend({level: 'set'}, qset.timer),
				timerModel = new TimerModel(timerOptions),
				timerView = new TimerView({model: timerModel});
			timerView.render();
		};
		//set next listener
		document.off('nextset');
		document.on('nextset', this.next, this);
	},
	addData: function(input){
		var askText = $('[name='+input.name+']').parents('.block').find('.ask').html(),
			itemText = $('[name='+input.name+']').parent().find('.item').html();
		input.ask = typeof itemText == 'undefined' ? askText : askText + '_' + itemText;
		input.page = _page+1;
		input.tmsp = Date.now();
		_options.attributes.data[input.name] = input;
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
	record: function(action){
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
		dataModel.record(action);
		return true;
	},
	next: function(e){
		//record data for the current set
		if (this.record('set')){
			this.$el.empty();
			//render the next set or page
			_set++;
			if (_set < this.model.get('sets').length){
				document.trigger('set>>');
				this.render();
			} else {
				document.trigger('>>');
			};
		};
	},
	back: function(){
		this.$el.empty();
		//render the previous set or page
		_set--;
		if (_set > -1){
			document.trigger('set<<');
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
			this.$el.empty();
			document.trigger('>>');
		};
	}
});

/*************** set questions *****************/

function setQuestions(options){
	//reset question set counter
	_set = 0;
	if (typeof options != 'undefined'){
		var dataModel = new Data(options.attributes);
		dataModel.record('init');
		//set global _options variable to config model
		_options = options;
		//add data object to hold all recorded data
		_options.set('data', {
			pid: {
				name: 'pid',
				value: pid
			}
		});
		questions = new Questions();
	};
	var Page = Backbone.DeepModel.extend(),
		page = _options.get('pages') ? new Page(_options.get('pages')[_page]) : null;
	if (page){
		questions.model = page;
		questions.resize(questions);
		questions.render();

		//set page timer
		if (page.attributes.hasOwnProperty('timer')){
			var timerOptions = _.extend({level: 'page'}, page.get('timer')),
				timerModel = new TimerModel(timerOptions),
				timerView = new TimerView({model: timerModel});
			timerView.render();
		};
	};

	document.trigger('ready');
};

/************** questions config **************/

function config(){
	var QuestionsConfig = Backbone.DeepModel.extend({
		url: _config+"/questions.json"
	});
	//get questions configuration options
	var qConfig = new QuestionsConfig();
	qConfig.on('sync error', setQuestions);
	qConfig.fetch();
};

function resetQuestions(){
	if (_options.attributes.hasOwnProperty("pages") && _options.get('pages').length > _page){
		setQuestions();
	};
};

//trigger next page
document.on({
	'>>': resetQuestions,
	'<<': resetQuestions
});

document.on('init', config);

//when both map and questions have loaded, lift the cover
var readycount = 0;
document.on('ready', function(){
	if (readycount == 1){
		$('#cover').fadeOut(500);
	} else {
		readycount++;
	}
});
})();
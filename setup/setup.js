(function(){

//templates
var optionTemplate = _.template( $('#option-template').html() ),
	dropdownTemplate = _.template( $('#dropdown-template').html() );

function createBooleanDropdown(select){
	//creates a yes-no dropdown menu
	var options = {
		yes: "true",
		no: "false"
	};
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
	})
	return select;
};

function changeStep(prevStep, currentStep){
	$('#'+prevStep).fadeOut(500, function(){
		$('#'+currentStep).fadeIn(500);
	});
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

	$('.step').each(function(){
		if ($(this).attr('id') != steps[step]){
			$(this).hide();
		};
	})

	$('button[name=next]').click(function(){
		prevStep = steps[step];
		step++;
		changeStep(prevStep, steps[step]);
	});

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
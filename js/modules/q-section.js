//Questions panel

(function(){

$('#q').html('<button type="button" id="nextpage">Next page!</button>');
$('#nextpage').click(function(){
	document.trigger('>>');
})






var _page = 0;
//trigger next page
document.on('>>', function(){
	_page++;
	//put some stuff here
});

})();
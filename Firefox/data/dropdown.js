/** This file handles search dropdowns */

var dropdowns = (function(){
	
	var blurred = true;
	
	/** Sets up dropdown results for an input field
	 * 	input: a jQuery object of the input field
	 * 	container: a jQuery object of a <ul> container to contain the dropdown results
	 * 	inputFunction: a function that takes the inputs value and an optional callback function (for async use)
	 * 	as its parameters and runs on focusin and on input that calculates and returns an array of the
	 * 	dropdown results. The results array is not sanitized.
	 * 	[submitOnClick]: A boolean value indicating whether or not to submit the input's form on clicking a
	 * 	value in the dropdown. Defaults to false.
	*/
	return function(input, container, inputFunction, submitOnClick){
		container.addClass("dropdown-container").css("border", 0);
		input.on("input focusin", function(){
			var text = $.trim($(this).val());
			if(!text.length){
				container.html("").css("border", 0);
				return;
			}
			var newSuggestions = $("<ul><li class='active'>"+$("<i></i>").text(text).html()+"</li></ul>");
			var results = inputFunction(text, function(results){
				for(var i=0; i<results.length; i++){
					newSuggestions.append("<li>"+$("<i></i>").text(results[i].toLowerCase()).html()+"</li>");
				}
				container.html(newSuggestions.html());
				container.css("border", container.children().length>1? "" : 0);
			});
			if(results){
				for(var i=0; i<results.length; i++){
					newSuggestions.append("<li>"+results[i].toLowerCase()+"</li>");
				}
				container.html(newSuggestions.html());
				container.css("border", container.children().length>1? "" : 0);
			}
		}).on("focusout", function(){
			if(blurred){
				container.html("").css("border", 0);
			}
			blurred = true;
		}).on("keydown", function(e){
			if((e.keyCode != '38' && e.keyCode != '40') || !container.html()){
				return;
			}
			e.preventDefault();
			if(e.keyCode == '38'){
				var newActive = container.find(".active").prev().length? container.find(".active").prev() : container.find("li").last();
			}
			else{
				var newActive = container.find(".active").next().length? container.find(".active").next() : container.find("li").first();
			}
			container.find(".active").removeClass("active");
			newActive.addClass("active");
			input.val(newActive.text());
		}).parents("form").on("submit", function(){
			container.html("").css("border", 0);
		});
		
		container.on("click", "li", function(){
			input.val($.trim($(this).text()));
			container.html("").css("border", 0);
			if(submitOnClick){
				blurred = true;
				container.html("").css("border", 0);
				input.parents("form").trigger("submit");
			}
		}).on("mousedown", "li", function(){
			blurred = false;
		}).on("mouseover", "li", function(){
			container.find(".active").removeClass("active");
			$(this).addClass(".active");
			$(this).addClass("active");
		}).on("mouseout", function(){
			container.find(".active").removeClass("active");
			container.find("li").first().addClass("active");
		});
	};
})();
/**
 * This frame script gets the fonts and css of the main page.
 * It needs Chrome access in order to read stylesheets and manipulate elements' pseudo classes.
**/

const Cc = Components.classes;
const Ci = Components.interfaces;

var domUtil = Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
var doc = content.document;
var window = content.window;

addMessageListener("grdMe@grd.me:fetch-frame-css", function(message){
	var uid = message.data.uid;
	var element = doc.querySelector("[grdMeUID='"+uid+"']");
	sendAsyncMessage("grdMe@grd.me:get-frame-css:"+uid, {
		css: setupChildren(element),
		fonts: getFonts()
	});
});

/** Get custom fonts for document */
function getFonts(){
	var fonts = [];
	for(var i=0; i<doc.styleSheets.length; i++){
		try{
			for(var j=0; j<doc.styleSheets[i].cssRules.length; j++){
				if(!doc.styleSheets[i].cssRules[j].cssText.toLowerCase().indexOf("@font-face")){
					fonts.push(doc.styleSheets[i].cssRules[j].cssText.replace(/javascript:/gi, ""));
				}
			}
		}
		catch(e){}
	}
	return fonts;
}

/** Return an array of selectors and css objects for children of an element
 * parent: the parent element to search down from
*/
function setupChildren(parent){
	const states = [{
		state: ":active",
		prop: 0x01
	},
	{
		state: ":focus",
		prop: 0x02
	},
	{
		state: ":hover",
		prop: 0x04
	},
	{
		state: ":before"
	},
	{
		state: ":after"
	}];
	
	var cssArr = [];
	var elements = parent.querySelectorAll("*");
	for(var i=0; i<elements.length; i++){
		var css = {
			normal: getCSS(elements[i])
		};
		if(elements[i].nodeName.toLowerCase() !== "grdme"){
			for(var j=0; j<states.length; j++){
				if(states[j].prop){
					domUtil.setContentState(elements[i], states[j].prop);
				}
				css[states[j].state] = getCSS(elements[i]);
				var rules = domUtil.getCSSStyleRules(elements[i]);
				if(rules){
					for(var k=0; k<rules.Count(); k++){
						var rule = rules.GetElementAt(k);
						if(isPageStyle(rule.parentStyleSheet)){
							for(var m=0; m<rule.style.length; m++){
								css[states[j].state][rule.style[m]] = rule.style[rule.style[m]];
							}
						}
					}
				}
				if(states[j].prop){
					domUtil.setContentState(elements[i], window);
				}
			}
		}
		cssArr.push({
			selector: getUniqueSelector(elements[i], parent),
			css: css
		});
	}
	return cssArr;
}

/** Return an object of all CSS attributes for a given element
 * element: the element whose CSS attributes are to be returned
*/
function getCSS(element){
    var dest = {},
    style, prop;
    if(window.getComputedStyle){
        if((style = window.getComputedStyle(element, null))){
            var val;
            if(style.length){
                for(var i = 0, l = style.length; i < l; i++){
                    prop = style[i];
					if(!(element.hasAttribute("grdMeAnchor") && prop.toLowerCase() === "display")){
						val = style.getPropertyValue(prop);
						dest[prop] = val;
					}
                }
            } else {
                for(prop in style){
					if(!(element.hasAttribute("grdMeAnchor") && prop.toLowerCase() === "display")){
						val = style.getPropertyValue(prop) || style[prop];
						dest[prop] = val;
					}
                }
            }
            return dest;
        }
    }
    if((style = element.currentStyle)){
        for(prop in style){
            dest[prop] = style[prop];
        }
        return dest;
    }
    if((style = element.style)){
        for(prop in style){
            if(typeof style[prop] != 'function'){
                dest[prop] = style[prop];
            }
        }
    }
    return dest;
}

/** Determines whether or not a stylesheet is a page stylesheet (ie not of the browser)
 * styleSheet: the styleSheet in question
*/
function isPageStyle(styleSheet){
  if(styleSheet.ownerNode){
    return true;
  }

  if(styleSheet.ownerRule instanceof Ci.nsIDOMCSSImportRule){
    return isPageStyle(styleSheet.parentStyleSheet);
  }

  return false;
}

/** Get the index of an element in regards to its parent
 * element: the element to index
*/
function indexEl(element){
	var nodeList = Array.prototype.slice.call(element.parentNode.children);
	return nodeList.indexOf(element);
}

/** Get the unique selector for qn element
 * elem: the element for which to get the selector
 * stop: the parent the selector should be relative to
*/
function getUniqueSelector(elem, stop){
    var parent = elem.parentNode;
	if(elem.hasAttribute("grdMeAnchor")){
		return "body "+elem.nodeName;
	}
    var selector = '>' + elem.nodeName + ':nth-child(' + (indexEl(elem) + 1) + ')';
    while (parent && parent !== stop) {
        selector = '>' + parent.nodeName + ':nth-child(' + (indexEl(parent) + 1) + ')' + selector;
        parent = parent.parentNode;
    }
    return "body"+selector;
}
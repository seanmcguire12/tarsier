"use strict";
const tarsierId = "__tarsier_id";
const tarsierDataAttribute = "data-tarsier-id";
const tarsierSelector = `#${tarsierId}`;
const reworkdVisibilityAttribute = "reworkd-original-visibility";
let originalDOM = document.body.cloneNode(true);
window.storeDOM = () => {
    originalDOM = document.body.cloneNode(true);
    console.log("DOM state stored.");
    return document.body.outerHTML;
};
window.restoreDOM = (storedDOM) => {
    console.log("Restoring DOM");
    if (storedDOM) {
        document.body.innerHTML = storedDOM;
    }
    else {
        console.error("No DOM state was provided.");
    }
};
const elIsVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(el);
    const isHidden = computedStyle.visibility === "hidden" ||
        computedStyle.display === "none" ||
        el.hidden ||
        (el.hasAttribute("disabled") && el.getAttribute("disabled"));
    const has0Opacity = computedStyle.opacity === "0";
    // Often input elements will have 0 opacity but still have some interactable component
    const isTransparent = has0Opacity && !hasLabel(el);
    const isDisplayContents = computedStyle.display === "contents";
    const isZeroSize = (rect.width === 0 || rect.height === 0) && !isDisplayContents; // display: contents elements have 0 width and height
    const isScriptOrStyle = el.tagName === "SCRIPT" || el.tagName === "STYLE";
    return !isHidden && !isTransparent && !isZeroSize && !isScriptOrStyle;
};
function hasLabel(element) {
    const tagsThatCanHaveLabels = ["input", "textarea", "select", "button"];
    if (!tagsThatCanHaveLabels.includes(element.tagName.toLowerCase())) {
        return false;
    }
    const escapedId = CSS.escape(element.id);
    const label = document.querySelector(`label[for="${escapedId}"]`);
    if (label) {
        return true;
    }
    // The label may not be directly associated with the element but may be a sibling
    const siblings = Array.from(element.parentElement?.children || []);
    for (let sibling of siblings) {
        if (sibling.tagName.toLowerCase() === "label") {
            return true;
        }
    }
    return false;
}
const isTaggableTextNode = (child) => {
    return isNonWhiteSpaceTextNode(child) && isTextNodeAValidWord(child);
};
const isNonWhiteSpaceTextNode = (child) => {
    return (child.nodeType === Node.TEXT_NODE &&
        child.textContent &&
        child.textContent.trim().length > 0 &&
        child.textContent.trim() !== "\u200B");
};
const isTextNodeAValidWord = (child) => {
    // We don't want to be tagging separator symbols like '|' or '/' or '>' etc
    const trimmedWord = child.textContent?.trim();
    return trimmedWord && (trimmedWord.match(/\w/) || trimmedWord.length > 3); // Regex matches any character, number, or _
};
const isImageElement = (el) => {
    return el.tagName.toLowerCase() === "img";
};
const inputs = ["a", "button", "textarea", "select", "details", "label"];
const isInteractable = (el) => {
    // If it is a label but has an input child that it is a label for, say not interactable
    if (el.tagName.toLowerCase() === "label" && el.querySelector("input")) {
        return false;
    }
    return (inputs.includes(el.tagName.toLowerCase()) ||
        // @ts-ignore
        (el.tagName.toLowerCase() === "input" && el.type !== "hidden") ||
        el.role === "button");
};
const text_input_types = [
    "text",
    "password",
    "email",
    "search",
    "url",
    "tel",
    "number",
];
const isTextInsertable = (el) => el.tagName.toLowerCase() === "textarea" ||
    (el.tagName.toLowerCase() === "input" &&
        text_input_types.includes(el.type));
// These tags may not have text but can still be interactable
const textLessTagWhiteList = ["input", "textarea", "select", "button", "a"];
const isTextLess = (el) => {
    const tagName = el.tagName.toLowerCase();
    if (textLessTagWhiteList.includes(tagName))
        return false;
    if (el.childElementCount > 0)
        return false;
    if ("innerText" in el && el.innerText.trim().length === 0) {
        // look for svg or img in the element
        const svg = el.querySelector("svg");
        const img = el.querySelector("img");
        if (svg || img)
            return false;
        return isElementInViewport(el);
    }
    return false;
};
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const isLargerThan1x1 = rect.width > 1 || rect.height > 1;
    let body = document.body, html = document.documentElement;
    const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    const width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
    return (isLargerThan1x1 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= height &&
        rect.right <= width);
}
function getElementXPath(element) {
    let path_parts = [];
    let iframe_str = "";
    if (element && element.ownerDocument !== window.document) {
        // assert element.iframe_index !== undefined, "Element is not in the main document and does not have an iframe_index attribute";
        iframe_str = `iframe[${element.getAttribute("iframe_index")}]`;
    }
    while (element) {
        if (!element.tagName) {
            element = element.parentNode;
            continue;
        }
        let tagName = element.tagName.toLowerCase();
        let prefix = window.fixNamespaces(tagName);
        let sibling_index = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === element.tagName && sibling.id != tarsierId) {
                sibling_index++;
            }
            sibling = sibling.previousElementSibling;
        }
        // Check next siblings to determine if index should be added
        let nextSibling = element.nextElementSibling;
        let shouldAddIndex = false;
        while (nextSibling) {
            if (nextSibling.tagName === element.tagName) {
                shouldAddIndex = true;
                break;
            }
            nextSibling = nextSibling.nextElementSibling;
        }
        if (sibling_index > 1 || shouldAddIndex) {
            prefix += `[${sibling_index}]`;
        }
        if (element.id) {
            prefix += `[@id="${element.id}"]`;
            // If the id is unique and we have enough path parts, we can stop
            if (path_parts.length > 3) {
                path_parts.unshift(prefix);
                return "//" + path_parts.join("/");
            }
        }
        else if (element.className) {
            prefix += `[@class="${element.className}"]`;
        }
        path_parts.unshift(prefix);
        element = element.parentNode;
    }
    return iframe_str + "//" + path_parts.join("/");
}
function create_tagged_span(idNum, symbol) {
    let idStr = `[${symbol}${idNum}]`;
    let idSpan = document.createElement("span");
    idSpan.id = tarsierId;
    idSpan.style.position = "relative";
    idSpan.style.display = "inline";
    idSpan.style.color = "white";
    idSpan.style.backgroundColor = "red";
    idSpan.style.padding = "1.5px";
    idSpan.style.borderRadius = "3px";
    idSpan.style.fontWeight = "bold";
    // idSpan.style.fontSize = "15px"; // Removing because OCR won't see small text among large font
    idSpan.style.fontFamily = "Arial";
    idSpan.style.margin = "1px";
    idSpan.style.lineHeight = "1.25";
    idSpan.style.letterSpacing = "2px";
    idSpan.style.zIndex = "2140000046";
    idSpan.style.clip = "auto";
    idSpan.style.height = "fit-content";
    idSpan.style.width = "fit-content";
    idSpan.style.minHeight = "15px";
    idSpan.style.minWidth = "23px";
    idSpan.style.maxHeight = "unset";
    idSpan.style.maxWidth = "unset";
    idSpan.textContent = idStr;
    idSpan.style.webkitTextFillColor = "white";
    idSpan.style.textShadow = "";
    idSpan.style.textDecoration = "none";
    idSpan.style.letterSpacing = "0px";
    idSpan.setAttribute(tarsierDataAttribute, idNum.toString());
    return idSpan;
}
const MIN_FONT_SIZE = 11;
const ensureMinimumTagFontSizes = () => {
    const tags = Array.from(document.querySelectorAll(tarsierSelector));
    tags.forEach((tag) => {
        let fontSize = parseFloat(window.getComputedStyle(tag).fontSize.split("px")[0]);
        if (fontSize < MIN_FONT_SIZE) {
            tag.style.fontSize = `${MIN_FONT_SIZE}px`;
        }
    });
};
window.tagifyWebpage = (tagLeafTexts = false) => {
    window.removeTags();
    hideMapElements();
    const allElements = getAllElementsInAllFrames();
    const rawElementsToTag = getElementsToTag(allElements, tagLeafTexts);
    const elementsToTag = removeNestedTags(rawElementsToTag);
    const tagMetadataDict = insertTags(elementsToTag, tagLeafTexts);
    shrinkCollidingTags();
    ensureMinimumTagFontSizes();
    return tagMetadataDict;
};
function getAllElementsInAllFrames() {
    // Main page
    const allElements = Array.from(document.body.querySelectorAll("*"));
    // Add all elements in iframes
    // NOTE: This still doesn't work for all iframes
    const iframes = document.getElementsByTagName("iframe");
    for (let i = 0; i < iframes.length; i++) {
        try {
            const frame = iframes[i];
            const iframeDocument = frame.contentDocument || frame.contentWindow?.document;
            if (!iframeDocument)
                continue;
            const iframeElements = Array.from(iframeDocument.querySelectorAll("*"));
            iframeElements.forEach((el) => el.setAttribute("iframe_index", i.toString()));
            allElements.push(...iframeElements);
        }
        catch (e) {
            console.error("Error accessing iframe content:", e);
        }
    }
    return allElements;
}
function getElementsToTag(allElements, tagLeafTexts) {
    const elementsToTag = [];
    for (let el of allElements) {
        if ((isTextLess(el) && !isImageElement(el)) || !elIsVisible(el)) {
            continue;
        }
        if (isInteractable(el) || isImageElement(el)) {
            elementsToTag.push(el);
        }
        else if (tagLeafTexts) {
            // Append the parent tag as it may have multiple individual child nodes with text
            // We will tag them individually later
            if (Array.from(el.childNodes).filter(isTaggableTextNode).length >= 1) {
                elementsToTag.push(el);
            }
        }
    }
    return elementsToTag;
}
function removeNestedTags(elementsToTag) {
    // An interactable element may have multiple tagged elements inside
    // Most commonly, the text will be tagged alongside the interactable element
    // In this case there is only one child, and we should remove this nested tag
    // In other cases, we will allow for the nested tagging
    const res = [...elementsToTag];
    elementsToTag.map((el) => {
        // Only interactable elements can have nested tags
        if (isInteractable(el)) {
            const elementsToRemove = [];
            el.querySelectorAll("*").forEach((child) => {
                const index = res.indexOf(child);
                if (index > -1) {
                    elementsToRemove.push(child);
                }
            });
            // Only remove nested tags if there is only a single element to remove
            if (elementsToRemove.length <= 2) {
                for (let element of elementsToRemove) {
                    res.splice(res.indexOf(element), 1);
                }
            }
        }
    });
    return res;
}
function getTagSymbol(el) {
    if (isInteractable(el)) {
        if (isTextInsertable(el))
            return "#";
        return el.tagName.toLowerCase() === "a" ? "@" : "$";
    }
    return isImageElement(el) ? "%" : "";
}
function insertTags(elementsToTag, tagLeafTexts) {
    function trimTextNodeStart(element) {
        // Trim leading whitespace from the element's text content
        // This way, the tag will be inline with the word and not textwrap
        // Element text
        if (!element.firstChild || element.firstChild.nodeType !== Node.TEXT_NODE) {
            return;
        }
        const textNode = element.firstChild;
        textNode.textContent = textNode.textContent.trimStart();
    }
    function getElementToInsertInto(element) {
        // An <a> tag may just be a wrapper over many elements. (Think an <a> with a <span> and another <span>
        // If these sub children are the only children, they might have styling that mis-positions the tag we're attempting to
        // insert. Because of this, we should drill down among these single children to insert this tag
        // Some elements might just be empty. They should not count as "children" and if there are candidates to drill down
        // into when these empty elements are considered, we should drill
        const childrenToConsider = Array.from(element.childNodes).filter((child) => {
            if (isNonWhiteSpaceTextNode(child)) {
                return true;
            }
            else if (child.nodeType === Node.TEXT_NODE) {
                return false;
            }
            return !(child.nodeType === Node.ELEMENT_NODE &&
                (isTextLess(child) ||
                    !elIsVisible(child)));
        });
        if (childrenToConsider.length === 1) {
            const child = childrenToConsider[0];
            // Also check its a span or P tag
            const elementsToDrillDown = [
                "div",
                "span",
                "p",
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
            ];
            if (child.nodeType === Node.ELEMENT_NODE &&
                elementsToDrillDown.includes(child.tagName.toLowerCase())) {
                return getElementToInsertInto(child);
            }
        }
        trimTextNodeStart(element);
        return element;
    }
    function getOpeningTag(el) {
        const elementWithoutChildren = el.cloneNode(false);
        const openingAndClosingTags = elementWithoutChildren.outerHTML;
        const tagName = elementWithoutChildren.tagName.toLowerCase();
        const closingTag = `</${tagName}>`;
        return openingAndClosingTags.endsWith(closingTag)
            ? openingAndClosingTags.slice(0, -closingTag.length)
            : openingAndClosingTags;
    }
    const tagDataList = [];
    let idNum = 0;
    function createAndInsertTag(el, xpath, textNodeIndex, isAbsolutelyPositioned, referenceNode = null, originalTextContent = null) {
        const symbol = getTagSymbol(el);
        const idSpan = create_tagged_span(idNum, symbol);
        const tagDataEntry = {
            tarsierId: idNum,
            xpath,
            element: el,
            tagElement: idSpan,
            textNodeIndex,
            originalTextContent,
        };
        if (referenceNode && el.parentElement) {
            el.insertBefore(idSpan, referenceNode);
        }
        else if (isTextInsertable(el) && el.parentElement) {
            el.parentElement.insertBefore(idSpan, el);
        }
        else {
            const insertionElement = getElementToInsertInto(el);
            insertionElement.prepend(idSpan);
            if (isAbsolutelyPositioned) {
                absolutelyPositionTagIfMisaligned(idSpan, insertionElement);
            }
        }
        if (isAbsolutelyPositioned && !referenceNode) {
            absolutelyPositionTagIfMisaligned(idSpan, el);
        }
        return tagDataEntry;
    }
    for (const el of elementsToTag) {
        const xpath = getElementXPath(el);
        if (isInteractable(el) || isImageElement(el)) {
            const isAbsolutelyPositioned = !isTextInsertable(el) || isImageElement(el);
            const originalTextContent = el.textContent?.trim() || null;
            const tagDataEntry = createAndInsertTag(el, xpath, null, isAbsolutelyPositioned, null, originalTextContent);
            tagDataList.push(tagDataEntry);
            idNum++;
        }
        else if (tagLeafTexts) {
            trimTextNodeStart(el);
            const textNodes = Array.from(el.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE);
            const validTextNodes = textNodes.filter(isTaggableTextNode);
            validTextNodes.forEach((child) => {
                const textNodeIndex = textNodes.indexOf(child) + 1;
                const originalTextContent = child.textContent?.trim() || null;
                const tagDataEntry = createAndInsertTag(el, xpath, textNodeIndex, false, child, originalTextContent);
                tagDataList.push(tagDataEntry);
                idNum++;
            });
        }
    }
    const tagDataDict = {};
    tagDataList.forEach((tagData) => {
        const elementHTML = getOpeningTag(tagData.element);
        const symbol = getTagSymbol(tagData.element) || "";
        const idString = `[ ${symbol}${symbol ? " " : ""}${tagData.tarsierId} ]`;
        const elementText = tagData.originalTextContent;
        tagDataDict[tagData.tarsierId] = {
            tarsierId: tagData.tarsierId,
            elementName: tagData.element.tagName.toLowerCase(),
            openingTagHTML: elementHTML,
            xpath: tagData.xpath,
            elementText: elementText,
            textNodeIndex: tagData.textNodeIndex,
            idSymbol: symbol,
            idString: idString,
        };
    });
    return tagDataDict;
}
function absolutelyPositionTagIfMisaligned(tag, reference) {
    /*
    Some tags don't get displayed on the page properly
    This occurs if the parent element children are disjointed from the parent
    In this case, we absolutely position the tag to the parent element
    */
    let tagRect = tag.getBoundingClientRect();
    if (!(tagRect.width === 0 || tagRect.height === 0)) {
        return;
    }
    const distanceThreshold = 250;
    // Check if the expected position is off-screen horizontally
    const expectedTagPositionRect = reference.getBoundingClientRect();
    if (expectedTagPositionRect.right < 0 ||
        expectedTagPositionRect.left >
            (window.innerWidth || document.documentElement.clientWidth)) {
        // Expected position is off-screen horizontally, remove the tag
        tag.remove();
        return; // Skip to the next tag
    }
    const referenceTopLeft = {
        x: expectedTagPositionRect.left,
        y: expectedTagPositionRect.top,
    };
    const tagCenter = {
        x: (tagRect.left + tagRect.right) / 2,
        y: (tagRect.top + tagRect.bottom) / 2,
    };
    const dx = Math.abs(referenceTopLeft.x - tagCenter.x);
    const dy = Math.abs(referenceTopLeft.y - tagCenter.y);
    if (dx > distanceThreshold || dy > distanceThreshold || !elIsVisible(tag)) {
        tag.style.position = "absolute";
        // Ensure the tag is positioned within the screen bounds
        let leftPosition = Math.max(0, expectedTagPositionRect.left - (tagRect.right + 3 - tagRect.left));
        leftPosition = Math.min(leftPosition, window.innerWidth - (tagRect.right - tagRect.left));
        let topPosition = Math.max(0, expectedTagPositionRect.top + 3); // Add some top buffer to center align better
        topPosition = Math.min(topPosition, Math.max(window.innerHeight, document.documentElement.scrollHeight) -
            (tagRect.bottom - tagRect.top));
        tag.style.left = `${leftPosition}px`;
        tag.style.top = `${topPosition}px`;
        tag.parentElement && tag.parentElement.removeChild(tag);
        document.body.appendChild(tag);
    }
}
const shrinkCollidingTags = () => {
    const tags = Array.from(document.querySelectorAll(tarsierSelector));
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        let tagRect = tag.getBoundingClientRect();
        let fontSize = parseFloat(window.getComputedStyle(tag).fontSize.split("px")[0]);
        for (let j = i + 1; j < tags.length; j++) {
            const otherTag = tags[j];
            let otherTagRect = otherTag.getBoundingClientRect();
            let otherFontSize = parseFloat(window.getComputedStyle(otherTag).fontSize.split("px")[0]);
            while (tagRect.left < otherTagRect.right &&
                tagRect.right > otherTagRect.left &&
                tagRect.top < otherTagRect.bottom &&
                tagRect.bottom > otherTagRect.top &&
                fontSize > MIN_FONT_SIZE &&
                otherFontSize > MIN_FONT_SIZE) {
                fontSize -= 0.5;
                otherFontSize -= 0.5;
                tag.style.fontSize = `${fontSize}px`;
                otherTag.style.fontSize = `${otherFontSize}px`;
                tagRect = tag.getBoundingClientRect();
                otherTagRect = otherTag.getBoundingClientRect();
            }
        }
    }
};
window.removeTags = () => {
    getAllElementsInAllFrames()
        .filter((element) => element.matches(tarsierSelector))
        .forEach((tag) => tag.remove());
    showMapElements();
};
const GOOGLE_MAPS_OPACITY_CONTROL = "__reworkd_google_maps_opacity";
const hideMapElements = () => {
    // Maps have lots of tiny buttons that need to be tagged
    // They also have a lot of tiny text and are annoying to deal with for rendering
    // Also any element with aria-label="Map" aria-roledescription="map"
    const selectors = [
        'iframe[src*="google.com/maps"]',
        'iframe[id*="gmap_canvas"]',
        ".maplibregl-map",
        ".mapboxgl-map",
        ".leaflet-container",
        'img[src*="maps.googleapis.com"]',
        '[aria-label="Map"]',
        ".cmp-location-map__map",
        '.map-view[data-role="mapView"]',
        ".google_Map-wrapper",
        ".google_map-wrapper",
        ".googleMap-wrapper",
        ".googlemap-wrapper",
        ".ls-map-canvas",
        ".gmapcluster",
        "#googleMap",
        "#googleMaps",
        "#googlemaps",
        "#googlemap",
        "#google_map",
        "#google_maps",
        "#MapId",
        ".geolocation-map-wrapper",
        ".locatorMap",
    ];
    document.querySelectorAll(selectors.join(", ")).forEach((element) => {
        const currentOpacity = window.getComputedStyle(element).opacity;
        // Store current opacity
        element.setAttribute("data-original-opacity", currentOpacity);
        element.style.opacity = "0";
    });
};
const showMapElements = () => {
    const elements = document.querySelectorAll(`[${GOOGLE_MAPS_OPACITY_CONTROL}]`);
    elements.forEach((element) => {
        element.style.opacity =
            element.getAttribute("data-original-opacity") || "1";
    });
};
window.hideNonTagElements = () => {
    const allElements = getAllElementsInAllFrames();
    allElements.forEach((el) => {
        const element = el;
        if (element.style.visibility) {
            element.setAttribute(reworkdVisibilityAttribute, element.style.visibility);
        }
        if (!element.id.startsWith(tarsierId)) {
            element.style.visibility = "hidden";
        }
        else {
            element.style.visibility = "visible";
        }
    });
};
window.fixNamespaces = (tagName) => {
    // Namespaces in XML give elements unique prefixes (e.g., "a:tag").
    // Standard XPath with namespaces can fail to find elements.
    // The `name()` function returns the full element name, including the prefix.
    // Using "/*[name()='a:tag']" ensures the XPath matches the element correctly.
    const validNamespaceTag = /^[a-zA-Z_][\w\-.]*:[a-zA-Z_][\w\-.]*$/;
    // Split the tagName by '#' (ID) and '.' (class) to isolate the tag name part
    const tagOnly = tagName.split(/[#.]/)[0];
    if (validNamespaceTag.test(tagOnly)) {
        // If it's a valid namespaced tag, wrap with the name() function
        return tagName.replace(tagOnly, `*[name()="${tagOnly}"]`);
    }
    return tagName;
};
window.revertVisibilities = () => {
    const allElements = getAllElementsInAllFrames();
    allElements.forEach((el) => {
        const element = el;
        if (element.getAttribute(reworkdVisibilityAttribute)) {
            element.style.visibility =
                element.getAttribute(reworkdVisibilityAttribute) || "true";
        }
        else {
            element.style.removeProperty("visibility");
        }
    });
};
function hasDirectTextContent(element) {
    const childNodesArray = Array.from(element.childNodes);
    for (let node of childNodesArray) {
        if (node.nodeType === Node.TEXT_NODE &&
            node.textContent &&
            node.textContent.trim().length > 0) {
            return true;
        }
    }
    return false;
}
window.hideNonColouredElements = () => {
    const allElements = document.body.querySelectorAll("*");
    allElements.forEach((el) => {
        const element = el;
        if (element.style.visibility) {
            element.setAttribute(reworkdVisibilityAttribute, element.style.visibility);
        }
        if (!element.hasAttribute("data-colored") ||
            element.getAttribute("data-colored") !== "true") {
            element.style.visibility = "hidden";
        }
        else {
            element.style.visibility = "visible";
        }
    });
};
function getNextColors(totalTags) {
    let colors = [];
    let step = Math.ceil(256 / Math.cbrt(totalTags)); // Start with the initial step size
    while (colors.length < totalTags) {
        colors = []; // Reset the colors array for each iteration
        for (let r = 0; r < 256; r += step) {
            for (let g = 0; g < 256; g += step) {
                for (let b = 0; b < 256; b += step) {
                    colors.push(`rgb(${r}, ${g}, ${b})`);
                    if (colors.length >= totalTags) {
                        // Stop generating colors once we reach the required amount
                        break;
                    }
                }
                if (colors.length >= totalTags) {
                    break;
                }
            }
            if (colors.length >= totalTags) {
                break;
            }
        }
        if (colors.length < totalTags) {
            step--; // Decrease the step to increase the number of generated colors
            if (step <= 0) {
                throw new Error("Step cannot be reduced further.");
            }
        }
    }
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return colors.slice(0, totalTags);
}
function colorDistance(color1, color2) {
    const rgb1 = color1.match(/\d+/g).map(Number);
    const rgb2 = color2.match(/\d+/g).map(Number);
    return Math.sqrt(Math.pow(rgb1[0] - rgb2[0], 2) +
        Math.pow(rgb1[1] - rgb2[1], 2) +
        Math.pow(rgb1[2] - rgb2[2], 2));
}
function assignColors(elements, colors) {
    const colorAssignments = new Map();
    const assignedColors = new Set();
    elements.forEach((element) => {
        let bestColor = null;
        let maxMinDistance = -1;
        colors.forEach((color) => {
            if (assignedColors.has(color))
                return;
            let minDistance = Infinity;
            assignedColors.forEach((assignedColor) => {
                const distance = colorDistance(color, assignedColor);
                minDistance = Math.min(minDistance, distance);
            });
            if (minDistance > maxMinDistance) {
                maxMinDistance = minDistance;
                bestColor = color;
            }
        });
        if (bestColor) {
            colorAssignments.set(element, bestColor);
            assignedColors.add(bestColor);
        }
        else {
            // Fallback: Assign the first unassigned color if no bestColor is found
            const remainingColors = colors.filter((c) => !assignedColors.has(c));
            bestColor = remainingColors[0];
            colorAssignments.set(element, bestColor);
            assignedColors.add(bestColor);
        }
    });
    return colorAssignments;
}
window.colourBasedTagify = (tagLeafTexts = false, tagless = false) => {
    const tagMappingWithTagMeta = window.tagifyWebpage(tagLeafTexts);
    window.removeTags();
    const insertedIdStrings = insertIdStringsIntoTextNodes(tagMappingWithTagMeta, tagless);
    const elements = collectElementsToColor(tagMappingWithTagMeta);
    const colorAssignments = getColorsForElements(elements);
    const colorMapping = createColorMappingAndApplyStyles(elements, colorAssignments, tagMappingWithTagMeta);
    return { colorMapping, tagMappingWithTagMeta, insertedIdStrings };
};
function insertIdStringsIntoTextNodes(tagMappingWithTagMeta, tagless) {
    let insertedIdStrings = [];
    Object.entries(tagMappingWithTagMeta).forEach(([id, meta]) => {
        if (meta.textNodeIndex !== undefined && meta.idString !== undefined) {
            const xpathWithTextNode = `${meta.xpath}/text()[${meta.textNodeIndex}]`;
            const textNode = document.evaluate(xpathWithTextNode, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (textNode && !tagless) {
                textNode.data = `${meta.idString} ${textNode.data}`;
                insertedIdStrings.push(meta.idString);
            }
        }
    });
    return insertedIdStrings;
}
function collectElementsToColor(tagMappingWithTagMeta) {
    const elements = [];
    const viewportWidth = window.innerWidth;
    Object.values(tagMappingWithTagMeta).forEach((meta) => {
        const { tarsierId: id, xpath } = meta;
        const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (node instanceof HTMLElement) {
            const computedStyle = getComputedStyle(node);
            if (computedStyle.display === "contents") {
                node.style.removeProperty("display");
            }
            const rect = node.getBoundingClientRect();
            if (rect.width > 0 &&
                rect.height > 0 &&
                rect.left >= 0 &&
                rect.right <= viewportWidth) {
                node.setAttribute("data-id", id.toString());
                elements.push(node);
            }
        }
    });
    return elements;
}
function getColorsForElements(elements) {
    const totalTags = elements.length;
    const colors = getNextColors(totalTags);
    const colorAssignments = assignColors(elements, colors);
    return colorAssignments;
}
function createColorMappingAndApplyStyles(elements, colorAssignments, tagMappingWithTagMeta) {
    const colorMapping = [];
    const bodyRect = document.body.getBoundingClientRect();
    const attribute = "data-colored";
    const taggedElements = new Set(Object.values(tagMappingWithTagMeta).map((meta) => meta.xpath));
    elements.forEach((element) => {
        const id = parseInt(element.getAttribute("data-id"));
        const color = colorAssignments.get(element);
        const rect = element.getBoundingClientRect();
        const midpoint = [rect.left, rect.top];
        const normalizedMidpoint = [
            (midpoint[0] - bodyRect.left) / bodyRect.width,
            (midpoint[1] - bodyRect.top) / bodyRect.height,
        ];
        const symbol = getTagSymbol(element) || "";
        const idSymbol = `[ ${symbol}${symbol ? " " : ""}${id} ]`;
        const { isFixed, fixedPosition } = getFixedPosition(element);
        colorMapping.push({
            id,
            idSymbol,
            color,
            xpath: tagMappingWithTagMeta[id].xpath,
            midpoint,
            normalizedMidpoint,
            width: rect.width,
            height: rect.height,
            isFixed,
            fixedPosition,
            boundingBoxX: rect.x,
            boundingBoxY: rect.y,
        });
        applyStylesToElement(element, color, attribute, taggedElements, rect);
    });
    return colorMapping;
}
function applyStylesToElement(element, color, attribute, taggedElements, rect) {
    if (element.tagName.toLowerCase() === "input" &&
        element.type === "checkbox") {
        applyStylesToCheckbox(element, color, attribute);
    }
    else if (element.tagName.toLowerCase() === "img") {
        applyStylesToImage(element, color, attribute);
    }
    else {
        element.style.setProperty("background-color", color, "important");
        element.style.setProperty("color", color, "important");
        element.style.setProperty("border-color", color, "important");
        element.style.setProperty("opacity", "1", "important");
        element.setAttribute(attribute, "true");
    }
    if (element.tagName.toLowerCase() === "a") {
        applyStylesToLink(element, taggedElements, rect);
    }
    // Hide untagged child elements
    Array.from(element.children).forEach((child) => {
        const childXpath = getElementXPath(child);
        const childComputedStyle = window.getComputedStyle(child);
        if (!taggedElements.has(childXpath) &&
            childComputedStyle.display !== "none") {
            child.style.visibility = "hidden";
        }
    });
}
function applyStylesToCheckbox(checkboxElement, color, attribute) {
    const originalWidth = checkboxElement.offsetWidth + 2 + "px";
    const originalHeight = checkboxElement.offsetHeight + 2 + "px";
    // Apply styles to make the checkbox appear filled
    checkboxElement.style.setProperty("width", originalWidth, "important");
    checkboxElement.style.setProperty("height", originalHeight, "important");
    checkboxElement.style.setProperty("background-color", color, "important");
    checkboxElement.style.setProperty("border", `2px solid ${color}`, "important");
    checkboxElement.style.setProperty("appearance", "none", "important");
    checkboxElement.style.setProperty("border-radius", "4px", "important");
    checkboxElement.style.setProperty("position", "relative", "important");
    checkboxElement.style.setProperty("cursor", "pointer", "important");
    checkboxElement.setAttribute(attribute, "true");
    // Add event listener for checkbox state change
    checkboxElement.addEventListener("change", function () {
        if (checkboxElement.checked) {
            checkboxElement.style.setProperty("background-color", color, "important");
        }
        else {
            checkboxElement.style.setProperty("background-color", color, "important");
        }
    });
}
function applyStylesToImage(element, color, attribute) {
    const imageWidth = element.offsetWidth;
    const imageHeight = element.offsetHeight;
    const rgbToHex = (rgb) => {
        const result = rgb.match(/\d+/g);
        return result
            ? result.map((x) => parseInt(x).toString(16).padStart(2, "0")).join("")
            : "000000";
    };
    const hexColor = rgbToHex(color);
    const newSrc = `https://craftypixels.com/placeholder-image/${imageWidth}x${imageHeight}/${hexColor}/${hexColor}`;
    element.setAttribute("src", newSrc);
    element.setAttribute(attribute, "true");
}
function applyStylesToLink(element, taggedElements, rect) {
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.backgroundImage !== "none") {
        element.style.backgroundImage = "none";
    }
    let hasTextChild = false;
    let hasImageChild = false;
    let boundingBoxGreaterThanZero = rect.width > 0 && rect.height > 0;
    let hasUnTaggedTextElement = false;
    // Check for text nodes and images within child elements
    Array.from(element.children).forEach((child) => {
        const childElement = child;
        if (childElement.textContent &&
            childElement.textContent.trim().length > 0) {
            hasTextChild = true;
        }
        if (childElement.tagName.toLowerCase() === "img") {
            hasImageChild = true;
        }
        // Check if child element itself is not tagged
        const childXpath = getElementXPath(childElement);
        if (!taggedElements.has(childXpath) &&
            childElement.textContent &&
            childElement.textContent.trim().length > 0) {
            hasUnTaggedTextElement = true;
        }
    });
    if ((!hasTextChild &&
        !hasImageChild &&
        !hasDirectTextContent(element) &&
        !boundingBoxGreaterThanZero) ||
        hasUnTaggedTextElement) {
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        element.style.display = "block";
    }
}
function createIdSymbol(idNum, el) {
    let idStr;
    if (isInteractable(el)) {
        if (isTextInsertable(el))
            idStr = `[ # ${idNum} ]`;
        else if (el.tagName.toLowerCase() == "a")
            idStr = `[ @ ${idNum} ]`;
        else
            idStr = `[ $ ${idNum} ]`;
    }
    else {
        idStr = `[ ${idNum} ]`;
    }
    return idStr;
}
window.createTextBoundingBoxes = () => {
    const style = document.createElement("style");
    document.head.appendChild(style);
    if (style.sheet) {
        style.sheet.insertRule(`
        .tarsier-highlighted-word, .tarsier-space {
          border: 0px solid orange;
          display: inline-block !important;
          visibility: visible;
        }
      `, 0);
    }
    function applyHighlighting(root) {
        root.querySelectorAll("body *").forEach((element) => {
            if (["SCRIPT", "STYLE", "IFRAME", "INPUT", "TEXTAREA"].includes(element.tagName)) {
                return;
            }
            let childNodes = Array.from(element.childNodes);
            childNodes.forEach((node) => {
                if (node.nodeType === 3 &&
                    node.textContent &&
                    node.textContent.trim().length > 0) {
                    let textContent = node.textContent.replace(/\u00A0/g, " ");
                    const tarsierTagRegex = /\[\s*(?:[$@#]?\s*\d+)\s*\]/g;
                    if (element.hasAttribute("selected")) {
                        let span = document.createElement("span");
                        span.className = "tarsier-highlighted-word";
                        span.textContent = textContent;
                        if (node.parentNode) {
                            node.parentNode.replaceChild(span, node);
                        }
                    }
                    else {
                        let parts = textContent.split(tarsierTagRegex);
                        let matches = textContent.match(tarsierTagRegex);
                        let fragment = document.createDocumentFragment();
                        parts.forEach((part, index) => {
                            let tokens = part.split(/(\s+)/g);
                            tokens.forEach((token) => {
                                let span = document.createElement("span");
                                if (token.trim().length === 0) {
                                    span.className = "tarsier-space";
                                }
                                else {
                                    span.className = "tarsier-highlighted-word";
                                }
                                span.textContent = token;
                                fragment.appendChild(span);
                            });
                            if (matches && matches[index]) {
                                let span = document.createElement("span");
                                span.className = "tarsier-highlighted-word";
                                span.textContent = matches[index];
                                fragment.appendChild(span);
                            }
                        });
                        if (fragment.childNodes.length > 0 && node.parentNode) {
                            element.insertBefore(fragment, node);
                            node.remove();
                        }
                    }
                }
            });
        });
    }
    applyHighlighting(document);
    document.querySelectorAll("iframe").forEach((iframe) => {
        try {
            iframe.contentWindow?.postMessage({ action: "highlight" }, "*");
        }
        catch (error) {
            console.error("Error accessing iframe content: ", error);
        }
    });
};
window.documentDimensions = () => {
    return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
    };
};
window.getElementBoundingBoxes = (xpath) => {
    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (element) {
        const isValidText = (text) => text && text.trim().length > 0;
        let dropDownElem = element.querySelector("option[selected]");
        if (!dropDownElem) {
            dropDownElem = element.querySelector("option");
        }
        if (dropDownElem) {
            const elemText = dropDownElem.textContent || "";
            if (isValidText(elemText)) {
                const parentRect = element.getBoundingClientRect();
                return [
                    {
                        text: elemText.trim(),
                        top: parentRect.top + window.scrollY,
                        left: parentRect.left + window.scrollX,
                        width: parentRect.width,
                        height: parentRect.height,
                    },
                ];
            }
            else {
                return [];
            }
        }
        let placeholderText = " ";
        if ((element.tagName.toLowerCase() === "input" ||
            element.tagName.toLowerCase() === "textarea") &&
            element.placeholder) {
            placeholderText = element.placeholder;
        }
        else if (element.tagName.toLowerCase() === "a") {
            placeholderText = " ";
        }
        else if (element.tagName.toLowerCase() === "img") {
            placeholderText = element.alt || " ";
        }
        const words = element.querySelectorAll(":scope > .tarsier-highlighted-word");
        const boundingBoxes = Array.from(words)
            .map((word) => {
            const rect = word.getBoundingClientRect();
            return {
                text: word.innerText || "",
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height * 0.75,
            };
        })
            .filter((box) => box.width > 0 &&
            box.height > 0 &&
            box.top >= 0 &&
            box.left >= 0 &&
            isValidText(box.text));
        if (words.length === 0) {
            const elementRect = element.getBoundingClientRect();
            return [
                {
                    text: placeholderText,
                    top: elementRect.top + window.scrollY,
                    left: elementRect.left + window.scrollX,
                    width: elementRect.width,
                    height: elementRect.height * 0.75,
                },
            ];
        }
        return boundingBoxes;
    }
    else {
        return [];
    }
};
function getFixedPosition(element) {
    let isFixed = false;
    let fixedPosition = "none";
    let currentElement = element;
    while (currentElement) {
        const style = window.getComputedStyle(currentElement);
        if (style.position === "fixed") {
            isFixed = true;
            const rect = currentElement.getBoundingClientRect();
            if (rect.top === 0) {
                fixedPosition = "top";
            }
            else if (rect.bottom === window.innerHeight) {
                fixedPosition = "bottom";
            }
            break;
        }
        currentElement = currentElement.parentElement;
    }
    return { isFixed, fixedPosition };
}
window.checkHasTaggedChildren = (xpath) => {
    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (element) {
        const taggedChildren = element.querySelector('[data-colored="true"]');
        return !!taggedChildren;
    }
    return false;
};
window.setElementVisibilityToHidden = (xpath) => {
    const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (element) {
        element.style.visibility = "hidden";
    }
    else {
        console.error(`Tried to hide element. Element not found for XPath: ${xpath}`);
    }
};
window.reColourElements = (colouredElems) => {
    const totalTags = colouredElems.length;
    const colors = getNextColors(totalTags);
    const elements = colouredElems.map((elem) => {
        const element = document.evaluate(elem.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        element.setAttribute("data-id", elem.id.toString());
        return element;
    });
    const colorAssignments = assignColors(elements, colors);
    const bodyRect = document.body.getBoundingClientRect();
    const updatedColouredElems = colouredElems.map((elem) => {
        const element = document.evaluate(elem.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        const color = colorAssignments.get(element);
        const rect = element.getBoundingClientRect();
        const midpoint = [rect.left, rect.top];
        const normalizedMidpoint = [
            (midpoint[0] - bodyRect.left) / bodyRect.width,
            (midpoint[1] - bodyRect.top) / bodyRect.height,
        ];
        element.style.setProperty("background-color", color, "important");
        element.style.setProperty("color", color, "important");
        element.style.setProperty("border-color", color, "important");
        element.style.setProperty("opacity", "1", "important");
        element.setAttribute("data-colored", "true");
        return {
            ...elem,
            color,
            midpoint,
            normalizedMidpoint,
            width: rect.width,
            height: rect.height,
            boundingBoxX: rect.x,
            boundingBoxY: rect.y,
        };
    });
    return updatedColouredElems;
};
window.disableTransitionsAndAnimations = () => {
    const style = document.createElement("style");
    style.innerHTML = `
    *, *::before, *::after {
      transition-property: none !important;
      transition-duration: 0s !important;
      transition-timing-function: none !important;
      transition-delay: 0s !important;
      animation: none !important;
      animation-name: none !important;
      animation-duration: 0s !important;
      animation-timing-function: none !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      animation-direction: normal !important;
      animation-fill-mode: none !important;
      animation-play-state: paused !important;
    }
  `;
    style.id = "disable-transitions";
    document.head.appendChild(style);
};
window.enableTransitionsAndAnimations = () => {
    const style = document.getElementById("disable-transitions");
    if (style) {
        style.remove();
    }
};
// LEAVE AS LAST LINE. DO NOT REMOVE
// JavaScript scripts, when run in the JavaScript console, will evaluate to the last line/expression in the script
// This tag utils file will typically end in a function assignment
// Function assignments will evaluate to the created function
// If playwright .evaluate(JS_CODE) evaluates to a function, IT WILL CALL THE FUNCTION
// This means that the last function in this file will randomly get called whenever we load in the JS,
// unless we have something like this console.log (Which returns undefined) is placed at the end
console.log("Tarsier tag utils loaded");
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnX3V0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGFnX3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUErREEsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDO0FBQ2pDLE1BQU0sb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7QUFDL0MsTUFBTSxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUN4QyxNQUFNLDBCQUEwQixHQUFHLDZCQUE2QixDQUFDO0FBR2pFLElBQUksV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRWhELE1BQU0sQ0FBQyxRQUFRLEdBQUcsR0FBRyxFQUFFO0lBQ3JCLFdBQVcsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDakMsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUNqQyxDQUFDLENBQUM7QUFFRixNQUFNLENBQUMsVUFBVSxHQUFHLENBQUMsU0FBUyxFQUFFLEVBQUU7SUFDaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM3QixJQUFJLFNBQVMsRUFBRTtRQUNiLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztLQUNyQztTQUFNO1FBQ0wsT0FBTyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO0tBQzdDO0FBQ0gsQ0FBQyxDQUFDO0FBRUYsTUFBTSxXQUFXLEdBQUcsQ0FBQyxFQUFlLEVBQUUsRUFBRTtJQUN0QyxNQUFNLElBQUksR0FBRyxFQUFFLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUN4QyxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFbEQsTUFBTSxRQUFRLEdBQ1os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S0FBSyxFQUFFO1FBQ1QsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO0tBQ2hCO0FBQ0gsQ0FBQyxDQUFDO0FBRUYsb0NBQW9DO0FBQ3BDLGtIQUFrSDtBQUNsSCxrRUFBa0U7QUFDbEUsNkRBQTZEO0FBQzdELHNGQUFzRjtBQUN0RixzR0FBc0c7QUFDdEcsZ0dBQWdHO0FBRWhHLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEJBQTBCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIG5vaW5zcGVjdGlvbiBKU1VudXNlZEdsb2JhbFN5bWJvbHNcbmludGVyZmFjZSBDb2xvdXJlZEVsZW0ge1xuICBpZDogbnVtYmVyO1xuICBpZFN5bWJvbDogc3RyaW5nO1xuICBjb2xvcjogc3RyaW5nO1xuICB4cGF0aDogc3RyaW5nO1xuICBtaWRwb2ludDogW251bWJlciwgbnVtYmVyXTtcbiAgbm9ybWFsaXplZE1pZHBvaW50OiBbbnVtYmVyLCBudW1iZXJdO1xuICB3aWR0aDogbnVtYmVyO1xuICBoZWlnaHQ6IG51bWJlcjtcbiAgaXNGaXhlZDogYm9vbGVhbjtcbiAgZml4ZWRQb3NpdGlvbjogc3RyaW5nOyAvLyAndG9wJywgJ2JvdHRvbScsICdub25lJ1xuICBib3VuZGluZ0JveFg6IG51bWJlcjtcbiAgYm91bmRpbmdCb3hZOiBudW1iZXI7XG59XG5pbnRlcmZhY2UgV2luZG93IHtcbiAgLy8gUGxheXdyaWdodCdzIC5ldmFsdWF0ZSBtZXRob2QgcnVucyBqYXZhc2NyaXB0IGNvZGUgaW4gYW4gaXNvbGF0ZWQgc2NvcGUuXG4gIC8vIFRoaXMgbWVhbnMgdGhhdCBzdWJzZXF1ZW50IGNhbGxzIHRvIC5ldmFsdWF0ZSB3aWxsIG5vdCBoYXZlIGFjY2VzcyB0byB0aGUgZnVuY3Rpb25zIGRlZmluZWQgaW4gdGhpcyBmaWxlXG4gIC8vIHNpbmNlIHRoZXkgd2lsbCBiZSBpbiBhbiBpbmFjY2Vzc2libGUgc2NvcGUuIFRvIGNpcmN1bXZlbnQgdGhpcywgd2UgYXR0YWNoIHRoZSBmb2xsb3dpbmcgbWV0aG9kcyB0byB0aGVcbiAgLy8gd2luZG93IHdoaWNoIGlzIGFsd2F5cyBhdmFpbGFibGUgZ2xvYmFsbHkgd2hlbiBydW4gaW4gYSBicm93c2VyIGVudmlyb25tZW50LlxuICB0YWdpZnlXZWJwYWdlOiAodGFnTGVhZlRleHRzPzogYm9vbGVhbikgPT4geyBbcDogbnVtYmVyXTogVGFnTWV0YWRhdGEgfTtcbiAgcmVtb3ZlVGFnczogKCkgPT4gdm9pZDtcbiAgaGlkZU5vblRhZ0VsZW1lbnRzOiAoKSA9PiB2b2lkO1xuICByZXZlcnRWaXNpYmlsaXRpZXM6ICgpID0+IHZvaWQ7XG4gIGZpeE5hbWVzcGFjZXM6ICh0YWdOYW1lOiBzdHJpbmcpID0+IHN0cmluZztcbiAgY29sb3VyQmFzZWRUYWdpZnk6IChcbiAgICB0YWdMZWFmVGV4dHM/OiBib29sZWFuLFxuICAgIHRhZ2xlc3M/OiBib29sZWFuLFxuICApID0+IHtcbiAgICBjb2xvck1hcHBpbmc6IENvbG91cmVkRWxlbVtdO1xuICAgIHRhZ01hcHBpbmdXaXRoVGFnTWV0YTogeyBbcDogbnVtYmVyXTogVGFnTWV0YWRhdGEgfTtcbiAgICBpbnNlcnRlZElkU3RyaW5nczogc3RyaW5nW107XG4gIH07XG4gIGhpZGVOb25Db2xvdXJlZEVsZW1lbnRzOiAoKSA9PiB2b2lkO1xuICBjcmVhdGVUZXh0Qm91bmRpbmdCb3hlczogKCkgPT4gdm9pZDtcbiAgZG9jdW1lbnREaW1lbnNpb25zOiAoKSA9PiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH07XG4gIGdldEVsZW1lbnRCb3VuZGluZ0JveGVzOiAoeHBhdGg6IHN0cmluZykgPT4ge1xuICAgIHRleHQ6IHN0cmluZztcbiAgICB0b3A6IG51bWJlcjtcbiAgICBsZWZ0OiBudW1iZXI7XG4gICAgd2lkdGg6IG51bWJlcjtcbiAgICBoZWlnaHQ6IG51bWJlcjtcbiAgfVtdO1xuICBjaGVja0hhc1RhZ2dlZENoaWxkcmVuOiAoeHBhdGg6IHN0cmluZykgPT4gYm9vbGVhbjtcbiAgc2V0RWxlbWVudFZpc2liaWxpdHlUb0hpZGRlbjogKHhwYXRoOiBzdHJpbmcpID0+IHZvaWQ7XG4gIHJlQ29sb3VyRWxlbWVudHM6IChjb2xvdXJlZEVsZW1zOiBDb2xvdXJlZEVsZW1bXSkgPT4gQ29sb3VyZWRFbGVtW107XG4gIGRpc2FibGVUcmFuc2l0aW9uc0FuZEFuaW1hdGlvbnM6ICgpID0+IHZvaWQ7XG4gIGVuYWJsZVRyYW5zaXRpb25zQW5kQW5pbWF0aW9uczogKCkgPT4gdm9pZDtcbiAgcmVzdG9yZURPTTogKHN0b3JlZERPTTogc3RyaW5nKSA9PiB2b2lkO1xuICBzdG9yZURPTTogKCkgPT4gc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVGFnTWV0YWRhdGEge1xuICB0YXJzaWVySWQ6IG51bWJlcjtcbiAgZWxlbWVudE5hbWU6IHN0cmluZztcbiAgb3BlbmluZ1RhZ0hUTUw6IHN0cmluZztcbiAgeHBhdGg6IHN0cmluZztcbiAgZWxlbWVudFRleHQ6IHN0cmluZyB8IG51bGw7XG4gIHRleHROb2RlSW5kZXg/OiBudW1iZXIgfCBudWxsOyAvLyBVc2VkIGlmIHRoZSB0YWcgcmVmZXJzIHRvIHNwZWNpZmljIFRleHROb2RlIGVsZW1lbnRzIHdpdGhpbiB0aGUgdGFnZ2VkIEVsZW1lbnROb2RlXG4gIGlkU3ltYm9sOiBzdHJpbmc7XG4gIGlkU3RyaW5nOiBzdHJpbmc7XG59XG5cbmNvbnN0IHRhcnNpZXJJZCA9IFwiX190YXJzaWVyX2lkXCI7XG5jb25zdCB0YXJzaWVyRGF0YUF0dHJpYnV0ZSA9IFwiZGF0YS10YXJzaWVyLWlkXCI7XG5jb25zdCB0YXJzaWVyU2VsZWN0b3IgPSBgIyR7dGFyc2llcklkfWA7XG5jb25zdCByZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSA9IFwicmV3b3JrZC1vcmlnaW5hbC12aXNpYmlsaXR5XCI7XG50eXBlIFRhZ1N5bWJvbCA9IFwiI1wiIHwgXCIkXCIgfCBcIkBcIiB8IFwiJVwiIHwgXCJcIjtcblxubGV0IG9yaWdpbmFsRE9NID0gZG9jdW1lbnQuYm9keS5jbG9uZU5vZGUodHJ1ZSk7XG5cbndpbmRvdy5zdG9yZURPTSA9ICgpID0+IHtcbiAgb3JpZ2luYWxET00gPSBkb2N1bWVudC5ib2R5LmNsb25lTm9kZSh0cnVlKTtcbiAgY29uc29sZS5sb2coXCJET00gc3RhdGUgc3RvcmVkLlwiKTtcbiAgcmV0dXJuIGRvY3VtZW50LmJvZHkub3V0ZXJIVE1MO1xufTtcblxud2luZG93LnJlc3RvcmVET00gPSAoc3RvcmVkRE9NKSA9PiB7XG4gIGNvbnNvbGUubG9nKFwiUmVzdG9yaW5nIERPTVwiKTtcbiAgaWYgKHN0b3JlZERPTSkge1xuICAgIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MID0gc3RvcmVkRE9NO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJObyBET00gc3RhdGUgd2FzIHByb3ZpZGVkLlwiKTtcbiAgfVxufTtcblxuY29uc3QgZWxJc1Zpc2libGUgPSAoZWw6IEhUTUxFbGVtZW50KSA9PiB7XG4gIGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgY29uc3QgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcblxuICBjb25zdCBpc0hpZGRlbiA9XG4gICAgY29tcHV0ZWRTdHlsZS52aXNpYmlsaXR5ID09PSBcImhpZGRlblwiIHx8XG4gICAgY29tcHV0ZWRTdHlsZS5kaXNwbGF5ID09PSBcIm5vbmVcIiB8fFxuICAgIGVsLmhpZGRlbiB8fFxuICAgIChlbC5oYXNBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKSAmJiBlbC5nZXRBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKSk7XG5cbiAgY29uc3QgaGFzME9wYWNpdHkgPSBjb21wdXRlZFN0eWxlLm9wYWNpdHkgPT09IFwiMFwiO1xuICAvLyBPZnRlbiBpbnB1dCBlbGVtZW50cyB3aWxsIGhhdmUgMCBvcGFjaXR5IGJ1dCBzdGlsbCBoYXZlIHNvbWUgaW50ZXJhY3RhYmxlIGNvbXBvbmVudFxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gaGFzME9wYWNpdHkgJiYgIWhhc0xhYmVsKGVsKTtcbiAgY29uc3QgaXNEaXNwbGF5Q29udGVudHMgPSBjb21wdXRlZFN0eWxlLmRpc3BsYXkgPT09IFwiY29udGVudHNcIjtcbiAgY29uc3QgaXNaZXJvU2l6ZSA9XG4gICAgKHJlY3Qud2lkdGggPT09IDAgfHwgcmVjdC5oZWlnaHQgPT09IDApICYmICFpc0Rpc3BsYXlDb250ZW50czsgLy8gZGlzcGxheTogY29udGVudHMgZWxlbWVudHMgaGF2ZSAwIHdpZHRoIGFuZCBoZWlnaHRcbiAgY29uc3QgaXNTY3JpcHRPclN0eWxlID0gZWwudGFnTmFtZSA9PT0gXCJTQ1JJUFRcIiB8fCBlbC50YWdOYW1lID09PSBcIlNUWUxFXCI7XG4gIHJldHVybiAhaXNIaWRkZW4gJiYgIWlzVHJhbnNwYXJlbnQgJiYgIWlzWmVyb1NpemUgJiYgIWlzU2NyaXB0T3JTdHlsZTtcbn07XG5cbmZ1bmN0aW9uIGhhc0xhYmVsKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XG4gIGNvbnN0IHRhZ3NUaGF0Q2FuSGF2ZUxhYmVscyA9IFtcImlucHV0XCIsIFwidGV4dGFyZWFcIiwgXCJzZWxlY3RcIiwgXCJidXR0b25cIl07XG5cbiAgaWYgKCF0YWdzVGhhdENhbkhhdmVMYWJlbHMuaW5jbHVkZXMoZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgZXNjYXBlZElkID0gQ1NTLmVzY2FwZShlbGVtZW50LmlkKTtcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBsYWJlbFtmb3I9XCIke2VzY2FwZWRJZH1cIl1gKTtcblxuICBpZiAobGFiZWwpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIFRoZSBsYWJlbCBtYXkgbm90IGJlIGRpcmVjdGx5IGFzc29jaWF0ZWQgd2l0aCB0aGUgZWxlbWVudCBidXQgbWF5IGJlIGEgc2libGluZ1xuICBjb25zdCBzaWJsaW5ncyA9IEFycmF5LmZyb20oZWxlbWVudC5wYXJlbnRFbGVtZW50Py5jaGlsZHJlbiB8fCBbXSk7XG4gIGZvciAobGV0IHNpYmxpbmcgb2Ygc2libGluZ3MpIHtcbiAgICBpZiAoc2libGluZy50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwibGFiZWxcIikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5jb25zdCBpc1RhZ2dhYmxlVGV4dE5vZGUgPSAoY2hpbGQ6IENoaWxkTm9kZSkgPT4ge1xuICByZXR1cm4gaXNOb25XaGl0ZVNwYWNlVGV4dE5vZGUoY2hpbGQpICYmIGlzVGV4dE5vZGVBVmFsaWRXb3JkKGNoaWxkKTtcbn07XG5cbmNvbnN0IGlzTm9uV2hpdGVTcGFjZVRleHROb2RlID0gKGNoaWxkOiBDaGlsZE5vZGUpID0+IHtcbiAgcmV0dXJuIChcbiAgICBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUgJiZcbiAgICBjaGlsZC50ZXh0Q29udGVudCAmJlxuICAgIGNoaWxkLnRleHRDb250ZW50LnRyaW0oKS5sZW5ndGggPiAwICYmXG4gICAgY2hpbGQudGV4dENvbnRlbnQudHJpbSgpICE9PSBcIlxcdTIwMEJcIlxuICApO1xufTtcblxuY29uc3QgaXNUZXh0Tm9kZUFWYWxpZFdvcmQgPSAoY2hpbGQ6IENoaWxkTm9kZSkgPT4ge1xuICAvLyBXZSBkb24ndCB3YW50IHRvIGJlIHRhZ2dpbmcgc2VwYXJhdG9yIHN5bWJvbHMgbGlrZSAnfCcgb3IgJy8nIG9yICc+JyBldGNcbiAgY29uc3QgdHJpbW1lZFdvcmQgPSBjaGlsZC50ZXh0Q29udGVudD8udHJpbSgpO1xuICByZXR1cm4gdHJpbW1lZFdvcmQgJiYgKHRyaW1tZWRXb3JkLm1hdGNoKC9cXHcvKSB8fCB0cmltbWVkV29yZC5sZW5ndGggPiAzKTsgLy8gUmVnZXggbWF0Y2hlcyBhbnkgY2hhcmFjdGVyLCBudW1iZXIsIG9yIF9cbn07XG5cbmNvbnN0IGlzSW1hZ2VFbGVtZW50ID0gKGVsOiBIVE1MRWxlbWVudCkgPT4ge1xuICByZXR1cm4gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImltZ1wiO1xufTtcblxuY29uc3QgaW5wdXRzID0gW1wiYVwiLCBcImJ1dHRvblwiLCBcInRleHRhcmVhXCIsIFwic2VsZWN0XCIsIFwiZGV0YWlsc1wiLCBcImxhYmVsXCJdO1xuY29uc3QgaXNJbnRlcmFjdGFibGUgPSAoZWw6IEhUTUxFbGVtZW50KSA9PiB7XG4gIC8vIElmIGl0IGlzIGEgbGFiZWwgYnV0IGhhcyBhbiBpbnB1dCBjaGlsZCB0aGF0IGl0IGlzIGEgbGFiZWwgZm9yLCBzYXkgbm90IGludGVyYWN0YWJsZVxuICBpZiAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImxhYmVsXCIgJiYgZWwucXVlcnlTZWxlY3RvcihcImlucHV0XCIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICBpbnB1dHMuaW5jbHVkZXMoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpKSB8fFxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImlucHV0XCIgJiYgZWwudHlwZSAhPT0gXCJoaWRkZW5cIikgfHxcbiAgICBlbC5yb2xlID09PSBcImJ1dHRvblwiXG4gICk7XG59O1xuXG5jb25zdCB0ZXh0X2lucHV0X3R5cGVzID0gW1xuICBcInRleHRcIixcbiAgXCJwYXNzd29yZFwiLFxuICBcImVtYWlsXCIsXG4gIFwic2VhcmNoXCIsXG4gIFwidXJsXCIsXG4gIFwidGVsXCIsXG4gIFwibnVtYmVyXCIsXG5dO1xuY29uc3QgaXNUZXh0SW5zZXJ0YWJsZSA9IChlbDogSFRNTEVsZW1lbnQpID0+XG4gIGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJ0ZXh0YXJlYVwiIHx8XG4gIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiaW5wdXRcIiAmJlxuICAgIHRleHRfaW5wdXRfdHlwZXMuaW5jbHVkZXMoKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnR5cGUpKTtcblxuLy8gVGhlc2UgdGFncyBtYXkgbm90IGhhdmUgdGV4dCBidXQgY2FuIHN0aWxsIGJlIGludGVyYWN0YWJsZVxuY29uc3QgdGV4dExlc3NUYWdXaGl0ZUxpc3QgPSBbXCJpbnB1dFwiLCBcInRleHRhcmVhXCIsIFwic2VsZWN0XCIsIFwiYnV0dG9uXCIsIFwiYVwiXTtcblxuY29uc3QgaXNUZXh0TGVzcyA9IChlbDogSFRNTEVsZW1lbnQpID0+IHtcbiAgY29uc3QgdGFnTmFtZSA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgaWYgKHRleHRMZXNzVGFnV2hpdGVMaXN0LmluY2x1ZGVzKHRhZ05hbWUpKSByZXR1cm4gZmFsc2U7XG4gIGlmIChlbC5jaGlsZEVsZW1lbnRDb3VudCA+IDApIHJldHVybiBmYWxzZTtcbiAgaWYgKFwiaW5uZXJUZXh0XCIgaW4gZWwgJiYgZWwuaW5uZXJUZXh0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcbiAgICAvLyBsb29rIGZvciBzdmcgb3IgaW1nIGluIHRoZSBlbGVtZW50XG4gICAgY29uc3Qgc3ZnID0gZWwucXVlcnlTZWxlY3RvcihcInN2Z1wiKTtcbiAgICBjb25zdCBpbWcgPSBlbC5xdWVyeVNlbGVjdG9yKFwiaW1nXCIpO1xuXG4gICAgaWYgKHN2ZyB8fCBpbWcpIHJldHVybiBmYWxzZTtcblxuICAgIHJldHVybiBpc0VsZW1lbnRJblZpZXdwb3J0KGVsKTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmZ1bmN0aW9uIGlzRWxlbWVudEluVmlld3BvcnQoZWw6IEhUTUxFbGVtZW50KSB7XG4gIGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICBjb25zdCBpc0xhcmdlclRoYW4xeDEgPSByZWN0LndpZHRoID4gMSB8fCByZWN0LmhlaWdodCA+IDE7XG5cbiAgbGV0IGJvZHkgPSBkb2N1bWVudC5ib2R5LFxuICAgIGh0bWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KFxuICAgIGJvZHkuc2Nyb2xsSGVpZ2h0LFxuICAgIGJvZHkub2Zmc2V0SGVpZ2h0LFxuICAgIGh0bWwuY2xpZW50SGVpZ2h0LFxuICAgIGh0bWwuc2Nyb2xsSGVpZ2h0LFxuICAgIGh0bWwub2Zmc2V0SGVpZ2h0LFxuICApO1xuICBjb25zdCB3aWR0aCA9IE1hdGgubWF4KFxuICAgIGJvZHkuc2Nyb2xsV2lkdGgsXG4gICAgYm9keS5vZmZzZXRXaWR0aCxcbiAgICBodG1sLmNsaWVudFdpZHRoLFxuICAgIGh0bWwuc2Nyb2xsV2lkdGgsXG4gICAgaHRtbC5vZmZzZXRXaWR0aCxcbiAgKTtcblxuICByZXR1cm4gKFxuICAgIGlzTGFyZ2VyVGhhbjF4MSAmJlxuICAgIHJlY3QudG9wID49IDAgJiZcbiAgICByZWN0LmxlZnQgPj0gMCAmJlxuICAgIHJlY3QuYm90dG9tIDw9IGhlaWdodCAmJlxuICAgIHJlY3QucmlnaHQgPD0gd2lkdGhcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudFhQYXRoKGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCkge1xuICBsZXQgcGF0aF9wYXJ0cyA9IFtdO1xuXG4gIGxldCBpZnJhbWVfc3RyID0gXCJcIjtcbiAgaWYgKGVsZW1lbnQgJiYgZWxlbWVudC5vd25lckRvY3VtZW50ICE9PSB3aW5kb3cuZG9jdW1lbnQpIHtcbiAgICAvLyBhc3NlcnQgZWxlbWVudC5pZnJhbWVfaW5kZXggIT09IHVuZGVmaW5lZCwgXCJFbGVtZW50IGlzIG5vdCBpbiB0aGUgbWFpbiBkb2N1bWVudCBhbmQgZG9lcyBub3QgaGF2ZSBhbiBpZnJhbWVfaW5kZXggYXR0cmlidXRlXCI7XG4gICAgaWZyYW1lX3N0ciA9IGBpZnJhbWVbJHtlbGVtZW50LmdldEF0dHJpYnV0ZShcImlmcmFtZV9pbmRleFwiKX1dYDtcbiAgfVxuXG4gIHdoaWxlIChlbGVtZW50KSB7XG4gICAgaWYgKCFlbGVtZW50LnRhZ05hbWUpIHtcbiAgICAgIGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudE5vZGUgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbGV0IHRhZ05hbWUgPSBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcblxuICAgIGxldCBwcmVmaXggPSB3aW5kb3cuZml4TmFtZXNwYWNlcyh0YWdOYW1lKTtcblxuICAgIGxldCBzaWJsaW5nX2luZGV4ID0gMTtcblxuICAgIGxldCBzaWJsaW5nID0gZWxlbWVudC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICAgIHdoaWxlIChzaWJsaW5nKSB7XG4gICAgICBpZiAoc2libGluZy50YWdOYW1lID09PSBlbGVtZW50LnRhZ05hbWUgJiYgc2libGluZy5pZCAhPSB0YXJzaWVySWQpIHtcbiAgICAgICAgc2libGluZ19pbmRleCsrO1xuICAgICAgfVxuICAgICAgc2libGluZyA9IHNpYmxpbmcucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICB9XG5cbiAgICAvLyBDaGVjayBuZXh0IHNpYmxpbmdzIHRvIGRldGVybWluZSBpZiBpbmRleCBzaG91bGQgYmUgYWRkZWRcbiAgICBsZXQgbmV4dFNpYmxpbmcgPSBlbGVtZW50Lm5leHRFbGVtZW50U2libGluZztcbiAgICBsZXQgc2hvdWxkQWRkSW5kZXggPSBmYWxzZTtcbiAgICB3aGlsZSAobmV4dFNpYmxpbmcpIHtcbiAgICAgIGlmIChuZXh0U2libGluZy50YWdOYW1lID09PSBlbGVtZW50LnRhZ05hbWUpIHtcbiAgICAgICAgc2hvdWxkQWRkSW5kZXggPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIG5leHRTaWJsaW5nID0gbmV4dFNpYmxpbmcubmV4dEVsZW1lbnRTaWJsaW5nO1xuICAgIH1cblxuICAgIGlmIChzaWJsaW5nX2luZGV4ID4gMSB8fCBzaG91bGRBZGRJbmRleCkge1xuICAgICAgcHJlZml4ICs9IGBbJHtzaWJsaW5nX2luZGV4fV1gO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50LmlkKSB7XG4gICAgICBwcmVmaXggKz0gYFtAaWQ9XCIke2VsZW1lbnQuaWR9XCJdYDtcblxuICAgICAgLy8gSWYgdGhlIGlkIGlzIHVuaXF1ZSBhbmQgd2UgaGF2ZSBlbm91Z2ggcGF0aCBwYXJ0cywgd2UgY2FuIHN0b3BcbiAgICAgIGlmIChwYXRoX3BhcnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgcGF0aF9wYXJ0cy51bnNoaWZ0KHByZWZpeCk7XG4gICAgICAgIHJldHVybiBcIi8vXCIgKyBwYXRoX3BhcnRzLmpvaW4oXCIvXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWxlbWVudC5jbGFzc05hbWUpIHtcbiAgICAgIHByZWZpeCArPSBgW0BjbGFzcz1cIiR7ZWxlbWVudC5jbGFzc05hbWV9XCJdYDtcbiAgICB9XG5cbiAgICBwYXRoX3BhcnRzLnVuc2hpZnQocHJlZml4KTtcbiAgICBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgfVxuICByZXR1cm4gaWZyYW1lX3N0ciArIFwiLy9cIiArIHBhdGhfcGFydHMuam9pbihcIi9cIik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZV90YWdnZWRfc3BhbihpZE51bTogbnVtYmVyLCBzeW1ib2w6IFRhZ1N5bWJvbCkge1xuICBsZXQgaWRTdHI6IHN0cmluZyA9IGBbJHtzeW1ib2x9JHtpZE51bX1dYDtcblxuICBsZXQgaWRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gIGlkU3Bhbi5pZCA9IHRhcnNpZXJJZDtcbiAgaWRTcGFuLnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICBpZFNwYW4uc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XG4gIGlkU3Bhbi5zdHlsZS5jb2xvciA9IFwid2hpdGVcIjtcbiAgaWRTcGFuLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwicmVkXCI7XG4gIGlkU3Bhbi5zdHlsZS5wYWRkaW5nID0gXCIxLjVweFwiO1xuICBpZFNwYW4uc3R5bGUuYm9yZGVyUmFkaXVzID0gXCIzcHhcIjtcbiAgaWRTcGFuLnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIjtcbiAgLy8gaWRTcGFuLnN0eWxlLmZvbnRTaXplID0gXCIxNXB4XCI7IC8vIFJlbW92aW5nIGJlY2F1c2UgT0NSIHdvbid0IHNlZSBzbWFsbCB0ZXh0IGFtb25nIGxhcmdlIGZvbnRcbiAgaWRTcGFuLnN0eWxlLmZvbnRGYW1pbHkgPSBcIkFyaWFsXCI7XG4gIGlkU3Bhbi5zdHlsZS5tYXJnaW4gPSBcIjFweFwiO1xuICBpZFNwYW4uc3R5bGUubGluZUhlaWdodCA9IFwiMS4yNVwiO1xuICBpZFNwYW4uc3R5bGUubGV0dGVyU3BhY2luZyA9IFwiMnB4XCI7XG4gIGlkU3Bhbi5zdHlsZS56SW5kZXggPSBcIjIxNDAwMDAwNDZcIjtcbiAgaWRTcGFuLnN0eWxlLmNsaXAgPSBcImF1dG9cIjtcbiAgaWRTcGFuLnN0eWxlLmhlaWdodCA9IFwiZml0LWNvbnRlbnRcIjtcbiAgaWRTcGFuLnN0eWxlLndpZHRoID0gXCJmaXQtY29udGVudFwiO1xuICBpZFNwYW4uc3R5bGUubWluSGVpZ2h0ID0gXCIxNXB4XCI7XG4gIGlkU3Bhbi5zdHlsZS5taW5XaWR0aCA9IFwiMjNweFwiO1xuICBpZFNwYW4uc3R5bGUubWF4SGVpZ2h0ID0gXCJ1bnNldFwiO1xuICBpZFNwYW4uc3R5bGUubWF4V2lkdGggPSBcInVuc2V0XCI7XG4gIGlkU3Bhbi50ZXh0Q29udGVudCA9IGlkU3RyO1xuICBpZFNwYW4uc3R5bGUud2Via2l0VGV4dEZpbGxDb2xvciA9IFwid2hpdGVcIjtcbiAgaWRTcGFuLnN0eWxlLnRleHRTaGFkb3cgPSBcIlwiO1xuICBpZFNwYW4uc3R5bGUudGV4dERlY29yYXRpb24gPSBcIm5vbmVcIjtcbiAgaWRTcGFuLnN0eWxlLmxldHRlclNwYWNpbmcgPSBcIjBweFwiO1xuXG4gIGlkU3Bhbi5zZXRBdHRyaWJ1dGUodGFyc2llckRhdGFBdHRyaWJ1dGUsIGlkTnVtLnRvU3RyaW5nKCkpO1xuXG4gIHJldHVybiBpZFNwYW47XG59XG5cbmNvbnN0IE1JTl9GT05UX1NJWkUgPSAxMTtcbmNvbnN0IGVuc3VyZU1pbmltdW1UYWdGb250U2l6ZXMgPSAoKSA9PiB7XG4gIGNvbnN0IHRhZ3MgPSBBcnJheS5mcm9tKFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFyc2llclNlbGVjdG9yKSxcbiAgKSBhcyBIVE1MRWxlbWVudFtdO1xuICB0YWdzLmZvckVhY2goKHRhZykgPT4ge1xuICAgIGxldCBmb250U2l6ZSA9IHBhcnNlRmxvYXQoXG4gICAgICB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0YWcpLmZvbnRTaXplLnNwbGl0KFwicHhcIilbMF0sXG4gICAgKTtcbiAgICBpZiAoZm9udFNpemUgPCBNSU5fRk9OVF9TSVpFKSB7XG4gICAgICB0YWcuc3R5bGUuZm9udFNpemUgPSBgJHtNSU5fRk9OVF9TSVpFfXB4YDtcbiAgICB9XG4gIH0pO1xufTtcblxud2luZG93LnRhZ2lmeVdlYnBhZ2UgPSAodGFnTGVhZlRleHRzID0gZmFsc2UpID0+IHtcbiAgd2luZG93LnJlbW92ZVRhZ3MoKTtcbiAgaGlkZU1hcEVsZW1lbnRzKCk7XG5cbiAgY29uc3QgYWxsRWxlbWVudHMgPSBnZXRBbGxFbGVtZW50c0luQWxsRnJhbWVzKCk7XG4gIGNvbnN0IHJhd0VsZW1lbnRzVG9UYWcgPSBnZXRFbGVtZW50c1RvVGFnKGFsbEVsZW1lbnRzLCB0YWdMZWFmVGV4dHMpO1xuICBjb25zdCBlbGVtZW50c1RvVGFnID0gcmVtb3ZlTmVzdGVkVGFncyhyYXdFbGVtZW50c1RvVGFnKTtcbiAgY29uc3QgdGFnTWV0YWRhdGFEaWN0ID0gaW5zZXJ0VGFncyhlbGVtZW50c1RvVGFnLCB0YWdMZWFmVGV4dHMpO1xuICBzaHJpbmtDb2xsaWRpbmdUYWdzKCk7XG4gIGVuc3VyZU1pbmltdW1UYWdGb250U2l6ZXMoKTtcblxuICByZXR1cm4gdGFnTWV0YWRhdGFEaWN0O1xufTtcblxuZnVuY3Rpb24gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpOiBIVE1MRWxlbWVudFtdIHtcbiAgLy8gTWFpbiBwYWdlXG4gIGNvbnN0IGFsbEVsZW1lbnRzOiBIVE1MRWxlbWVudFtdID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpLFxuICApO1xuXG4gIC8vIEFkZCBhbGwgZWxlbWVudHMgaW4gaWZyYW1lc1xuICAvLyBOT1RFOiBUaGlzIHN0aWxsIGRvZXNuJ3Qgd29yayBmb3IgYWxsIGlmcmFtZXNcbiAgY29uc3QgaWZyYW1lcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaWZyYW1lXCIpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGlmcmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZnJhbWUgPSBpZnJhbWVzW2ldO1xuICAgICAgY29uc3QgaWZyYW1lRG9jdW1lbnQgPVxuICAgICAgICBmcmFtZS5jb250ZW50RG9jdW1lbnQgfHwgZnJhbWUuY29udGVudFdpbmRvdz8uZG9jdW1lbnQ7XG4gICAgICBpZiAoIWlmcmFtZURvY3VtZW50KSBjb250aW51ZTtcblxuICAgICAgY29uc3QgaWZyYW1lRWxlbWVudHMgPSBBcnJheS5mcm9tKFxuICAgICAgICBpZnJhbWVEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKSxcbiAgICAgICkgYXMgSFRNTEVsZW1lbnRbXTtcbiAgICAgIGlmcmFtZUVsZW1lbnRzLmZvckVhY2goKGVsKSA9PlxuICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoXCJpZnJhbWVfaW5kZXhcIiwgaS50b1N0cmluZygpKSxcbiAgICAgICk7XG4gICAgICBhbGxFbGVtZW50cy5wdXNoKC4uLmlmcmFtZUVsZW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgYWNjZXNzaW5nIGlmcmFtZSBjb250ZW50OlwiLCBlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYWxsRWxlbWVudHM7XG59XG5cbmZ1bmN0aW9uIGdldEVsZW1lbnRzVG9UYWcoXG4gIGFsbEVsZW1lbnRzOiBIVE1MRWxlbWVudFtdLFxuICB0YWdMZWFmVGV4dHM6IGJvb2xlYW4sXG4pOiBIVE1MRWxlbWVudFtdIHtcbiAgY29uc3QgZWxlbWVudHNUb1RhZzogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGZvciAobGV0IGVsIG9mIGFsbEVsZW1lbnRzKSB7XG4gICAgaWYgKChpc1RleHRMZXNzKGVsKSAmJiAhaXNJbWFnZUVsZW1lbnQoZWwpKSB8fCAhZWxJc1Zpc2libGUoZWwpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoaXNJbnRlcmFjdGFibGUoZWwpIHx8IGlzSW1hZ2VFbGVtZW50KGVsKSkge1xuICAgICAgZWxlbWVudHNUb1RhZy5wdXNoKGVsKTtcbiAgICB9IGVsc2UgaWYgKHRhZ0xlYWZUZXh0cykge1xuICAgICAgLy8gQXBwZW5kIHRoZSBwYXJlbnQgdGFnIGFzIGl0IG1heSBoYXZlIG11bHRpcGxlIGluZGl2aWR1YWwgY2hpbGQgbm9kZXMgd2l0aCB0ZXh0XG4gICAgICAvLyBXZSB3aWxsIHRhZyB0aGVtIGluZGl2aWR1YWxseSBsYXRlclxuICAgICAgaWYgKEFycmF5LmZyb20oZWwuY2hpbGROb2RlcykuZmlsdGVyKGlzVGFnZ2FibGVUZXh0Tm9kZSkubGVuZ3RoID49IDEpIHtcbiAgICAgICAgZWxlbWVudHNUb1RhZy5wdXNoKGVsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZWxlbWVudHNUb1RhZztcbn1cblxuZnVuY3Rpb24gcmVtb3ZlTmVzdGVkVGFncyhlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdKTogSFRNTEVsZW1lbnRbXSB7XG4gIC8vIEFuIGludGVyYWN0YWJsZSBlbGVtZW50IG1heSBoYXZlIG11bHRpcGxlIHRhZ2dlZCBlbGVtZW50cyBpbnNpZGVcbiAgLy8gTW9zdCBjb21tb25seSwgdGhlIHRleHQgd2lsbCBiZSB0YWdnZWQgYWxvbmdzaWRlIHRoZSBpbnRlcmFjdGFibGUgZWxlbWVudFxuICAvLyBJbiB0aGlzIGNhc2UgdGhlcmUgaXMgb25seSBvbmUgY2hpbGQsIGFuZCB3ZSBzaG91bGQgcmVtb3ZlIHRoaXMgbmVzdGVkIHRhZ1xuICAvLyBJbiBvdGhlciBjYXNlcywgd2Ugd2lsbCBhbGxvdyBmb3IgdGhlIG5lc3RlZCB0YWdnaW5nXG5cbiAgY29uc3QgcmVzID0gWy4uLmVsZW1lbnRzVG9UYWddO1xuICBlbGVtZW50c1RvVGFnLm1hcCgoZWwpID0+IHtcbiAgICAvLyBPbmx5IGludGVyYWN0YWJsZSBlbGVtZW50cyBjYW4gaGF2ZSBuZXN0ZWQgdGFnc1xuICAgIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnRzVG9SZW1vdmU6IEhUTUxFbGVtZW50W10gPSBbXTtcbiAgICAgIGVsLnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpLmZvckVhY2goKGNoaWxkKSA9PiB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gcmVzLmluZGV4T2YoY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgIGVsZW1lbnRzVG9SZW1vdmUucHVzaChjaGlsZCBhcyBIVE1MRWxlbWVudCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBPbmx5IHJlbW92ZSBuZXN0ZWQgdGFncyBpZiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGVsZW1lbnQgdG8gcmVtb3ZlXG4gICAgICBpZiAoZWxlbWVudHNUb1JlbW92ZS5sZW5ndGggPD0gMikge1xuICAgICAgICBmb3IgKGxldCBlbGVtZW50IG9mIGVsZW1lbnRzVG9SZW1vdmUpIHtcbiAgICAgICAgICByZXMuc3BsaWNlKHJlcy5pbmRleE9mKGVsZW1lbnQpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gZ2V0VGFnU3ltYm9sKGVsOiBIVE1MRWxlbWVudCk6IFRhZ1N5bWJvbCB7XG4gIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcbiAgICBpZiAoaXNUZXh0SW5zZXJ0YWJsZShlbCkpIHJldHVybiBcIiNcIjtcbiAgICByZXR1cm4gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImFcIiA/IFwiQFwiIDogXCIkXCI7XG4gIH1cbiAgcmV0dXJuIGlzSW1hZ2VFbGVtZW50KGVsKSA/IFwiJVwiIDogXCJcIjtcbn1cblxuZnVuY3Rpb24gaW5zZXJ0VGFncyhcbiAgZWxlbWVudHNUb1RhZzogSFRNTEVsZW1lbnRbXSxcbiAgdGFnTGVhZlRleHRzOiBib29sZWFuLFxuKTogeyBbcDogbnVtYmVyXTogVGFnTWV0YWRhdGEgfSB7XG4gIGZ1bmN0aW9uIHRyaW1UZXh0Tm9kZVN0YXJ0KGVsZW1lbnQ6IEhUTUxFbGVtZW50KSB7XG4gICAgLy8gVHJpbSBsZWFkaW5nIHdoaXRlc3BhY2UgZnJvbSB0aGUgZWxlbWVudCdzIHRleHQgY29udGVudFxuICAgIC8vIFRoaXMgd2F5LCB0aGUgdGFnIHdpbGwgYmUgaW5saW5lIHdpdGggdGhlIHdvcmQgYW5kIG5vdCB0ZXh0d3JhcFxuICAgIC8vIEVsZW1lbnQgdGV4dFxuICAgIGlmICghZWxlbWVudC5maXJzdENoaWxkIHx8IGVsZW1lbnQuZmlyc3RDaGlsZC5ub2RlVHlwZSAhPT0gTm9kZS5URVhUX05PREUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGV4dE5vZGUgPSBlbGVtZW50LmZpcnN0Q2hpbGQgYXMgVGV4dDtcbiAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRleHROb2RlLnRleHRDb250ZW50IS50cmltU3RhcnQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEVsZW1lbnRUb0luc2VydEludG8oZWxlbWVudDogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB7XG4gICAgLy8gQW4gPGE+IHRhZyBtYXkganVzdCBiZSBhIHdyYXBwZXIgb3ZlciBtYW55IGVsZW1lbnRzLiAoVGhpbmsgYW4gPGE+IHdpdGggYSA8c3Bhbj4gYW5kIGFub3RoZXIgPHNwYW4+XG4gICAgLy8gSWYgdGhlc2Ugc3ViIGNoaWxkcmVuIGFyZSB0aGUgb25seSBjaGlsZHJlbiwgdGhleSBtaWdodCBoYXZlIHN0eWxpbmcgdGhhdCBtaXMtcG9zaXRpb25zIHRoZSB0YWcgd2UncmUgYXR0ZW1wdGluZyB0b1xuICAgIC8vIGluc2VydC4gQmVjYXVzZSBvZiB0aGlzLCB3ZSBzaG91bGQgZHJpbGwgZG93biBhbW9uZyB0aGVzZSBzaW5nbGUgY2hpbGRyZW4gdG8gaW5zZXJ0IHRoaXMgdGFnXG5cbiAgICAvLyBTb21lIGVsZW1lbnRzIG1pZ2h0IGp1c3QgYmUgZW1wdHkuIFRoZXkgc2hvdWxkIG5vdCBjb3VudCBhcyBcImNoaWxkcmVuXCIgYW5kIGlmIHRoZXJlIGFyZSBjYW5kaWRhdGVzIHRvIGRyaWxsIGRvd25cbiAgICAvLyBpbnRvIHdoZW4gdGhlc2UgZW1wdHkgZWxlbWVudHMgYXJlIGNvbnNpZGVyZWQsIHdlIHNob3VsZCBkcmlsbFxuICAgIGNvbnN0IGNoaWxkcmVuVG9Db25zaWRlciA9IEFycmF5LmZyb20oZWxlbWVudC5jaGlsZE5vZGVzKS5maWx0ZXIoXG4gICAgICAoY2hpbGQpID0+IHtcbiAgICAgICAgaWYgKGlzTm9uV2hpdGVTcGFjZVRleHROb2RlKGNoaWxkKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAhKFxuICAgICAgICAgIGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJlxuICAgICAgICAgIChpc1RleHRMZXNzKGNoaWxkIGFzIEhUTUxFbGVtZW50KSB8fFxuICAgICAgICAgICAgIWVsSXNWaXNpYmxlKGNoaWxkIGFzIEhUTUxFbGVtZW50KSlcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIGlmIChjaGlsZHJlblRvQ29uc2lkZXIubGVuZ3RoID09PSAxKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IGNoaWxkcmVuVG9Db25zaWRlclswXTtcbiAgICAgIC8vIEFsc28gY2hlY2sgaXRzIGEgc3BhbiBvciBQIHRhZ1xuICAgICAgY29uc3QgZWxlbWVudHNUb0RyaWxsRG93biA9IFtcbiAgICAgICAgXCJkaXZcIixcbiAgICAgICAgXCJzcGFuXCIsXG4gICAgICAgIFwicFwiLFxuICAgICAgICBcImgxXCIsXG4gICAgICAgIFwiaDJcIixcbiAgICAgICAgXCJoM1wiLFxuICAgICAgICBcImg0XCIsXG4gICAgICAgIFwiaDVcIixcbiAgICAgICAgXCJoNlwiLFxuICAgICAgXTtcbiAgICAgIGlmIChcbiAgICAgICAgY2hpbGQubm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFICYmXG4gICAgICAgIGVsZW1lbnRzVG9EcmlsbERvd24uaW5jbHVkZXMoXG4gICAgICAgICAgKGNoaWxkIGFzIEhUTUxFbGVtZW50KS50YWdOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhjaGlsZCBhcyBIVE1MRWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdHJpbVRleHROb2RlU3RhcnQoZWxlbWVudCk7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRPcGVuaW5nVGFnKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gICAgY29uc3QgZWxlbWVudFdpdGhvdXRDaGlsZHJlbiA9IGVsLmNsb25lTm9kZShmYWxzZSkgYXMgSFRNTEVsZW1lbnQ7XG4gICAgY29uc3Qgb3BlbmluZ0FuZENsb3NpbmdUYWdzID0gZWxlbWVudFdpdGhvdXRDaGlsZHJlbi5vdXRlckhUTUw7XG4gICAgY29uc3QgdGFnTmFtZSA9IGVsZW1lbnRXaXRob3V0Q2hpbGRyZW4udGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGNsb3NpbmdUYWcgPSBgPC8ke3RhZ05hbWV9PmA7XG5cbiAgICByZXR1cm4gb3BlbmluZ0FuZENsb3NpbmdUYWdzLmVuZHNXaXRoKGNsb3NpbmdUYWcpXG4gICAgICA/IG9wZW5pbmdBbmRDbG9zaW5nVGFncy5zbGljZSgwLCAtY2xvc2luZ1RhZy5sZW5ndGgpXG4gICAgICA6IG9wZW5pbmdBbmRDbG9zaW5nVGFncztcbiAgfVxuXG4gIGNvbnN0IHRhZ0RhdGFMaXN0OiB7XG4gICAgdGFyc2llcklkOiBudW1iZXI7XG4gICAgeHBhdGg6IHN0cmluZztcbiAgICBlbGVtZW50OiBIVE1MRWxlbWVudDtcbiAgICB0YWdFbGVtZW50OiBIVE1MRWxlbWVudDtcbiAgICB0ZXh0Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsO1xuICAgIG9yaWdpbmFsVGV4dENvbnRlbnQ6IHN0cmluZyB8IG51bGw7XG4gIH1bXSA9IFtdO1xuICBsZXQgaWROdW0gPSAwO1xuXG4gIGZ1bmN0aW9uIGNyZWF0ZUFuZEluc2VydFRhZyhcbiAgICBlbDogSFRNTEVsZW1lbnQsXG4gICAgeHBhdGg6IHN0cmluZyxcbiAgICB0ZXh0Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsLFxuICAgIGlzQWJzb2x1dGVseVBvc2l0aW9uZWQ6IGJvb2xlYW4sXG4gICAgcmVmZXJlbmNlTm9kZTogQ2hpbGROb2RlIHwgbnVsbCA9IG51bGwsXG4gICAgb3JpZ2luYWxUZXh0Q29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGwsXG4gICkge1xuICAgIGNvbnN0IHN5bWJvbCA9IGdldFRhZ1N5bWJvbChlbCk7XG4gICAgY29uc3QgaWRTcGFuID0gY3JlYXRlX3RhZ2dlZF9zcGFuKGlkTnVtLCBzeW1ib2wpO1xuXG4gICAgY29uc3QgdGFnRGF0YUVudHJ5ID0ge1xuICAgICAgdGFyc2llcklkOiBpZE51bSxcbiAgICAgIHhwYXRoLFxuICAgICAgZWxlbWVudDogZWwsXG4gICAgICB0YWdFbGVtZW50OiBpZFNwYW4sXG4gICAgICB0ZXh0Tm9kZUluZGV4LFxuICAgICAgb3JpZ2luYWxUZXh0Q29udGVudCxcbiAgICB9O1xuXG4gICAgaWYgKHJlZmVyZW5jZU5vZGUgJiYgZWwucGFyZW50RWxlbWVudCkge1xuICAgICAgZWwuaW5zZXJ0QmVmb3JlKGlkU3BhbiwgcmVmZXJlbmNlTm9kZSk7XG4gICAgfSBlbHNlIGlmIChpc1RleHRJbnNlcnRhYmxlKGVsKSAmJiBlbC5wYXJlbnRFbGVtZW50KSB7XG4gICAgICBlbC5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShpZFNwYW4sIGVsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaW5zZXJ0aW9uRWxlbWVudCA9IGdldEVsZW1lbnRUb0luc2VydEludG8oZWwpO1xuICAgICAgaW5zZXJ0aW9uRWxlbWVudC5wcmVwZW5kKGlkU3Bhbik7XG4gICAgICBpZiAoaXNBYnNvbHV0ZWx5UG9zaXRpb25lZCkge1xuICAgICAgICBhYnNvbHV0ZWx5UG9zaXRpb25UYWdJZk1pc2FsaWduZWQoaWRTcGFuLCBpbnNlcnRpb25FbGVtZW50KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNBYnNvbHV0ZWx5UG9zaXRpb25lZCAmJiAhcmVmZXJlbmNlTm9kZSkge1xuICAgICAgYWJzb2x1dGVseVBvc2l0aW9uVGFnSWZNaXNhbGlnbmVkKGlkU3BhbiwgZWwpO1xuICAgIH1cblxuICAgIHJldHVybiB0YWdEYXRhRW50cnk7XG4gIH1cblxuICBmb3IgKGNvbnN0IGVsIG9mIGVsZW1lbnRzVG9UYWcpIHtcbiAgICBjb25zdCB4cGF0aCA9IGdldEVsZW1lbnRYUGF0aChlbCk7XG5cbiAgICBpZiAoaXNJbnRlcmFjdGFibGUoZWwpIHx8IGlzSW1hZ2VFbGVtZW50KGVsKSkge1xuICAgICAgY29uc3QgaXNBYnNvbHV0ZWx5UG9zaXRpb25lZCA9XG4gICAgICAgICFpc1RleHRJbnNlcnRhYmxlKGVsKSB8fCBpc0ltYWdlRWxlbWVudChlbCk7XG5cbiAgICAgIGNvbnN0IG9yaWdpbmFsVGV4dENvbnRlbnQgPSBlbC50ZXh0Q29udGVudD8udHJpbSgpIHx8IG51bGw7XG5cbiAgICAgIGNvbnN0IHRhZ0RhdGFFbnRyeSA9IGNyZWF0ZUFuZEluc2VydFRhZyhcbiAgICAgICAgZWwsXG4gICAgICAgIHhwYXRoLFxuICAgICAgICBudWxsLFxuICAgICAgICBpc0Fic29sdXRlbHlQb3NpdGlvbmVkLFxuICAgICAgICBudWxsLFxuICAgICAgICBvcmlnaW5hbFRleHRDb250ZW50LFxuICAgICAgKTtcblxuICAgICAgdGFnRGF0YUxpc3QucHVzaCh0YWdEYXRhRW50cnkpO1xuICAgICAgaWROdW0rKztcbiAgICB9IGVsc2UgaWYgKHRhZ0xlYWZUZXh0cykge1xuICAgICAgdHJpbVRleHROb2RlU3RhcnQoZWwpO1xuICAgICAgY29uc3QgdGV4dE5vZGVzID0gQXJyYXkuZnJvbShlbC5jaGlsZE5vZGVzKS5maWx0ZXIoXG4gICAgICAgIChjaGlsZCkgPT4gY2hpbGQubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFLFxuICAgICAgKTtcbiAgICAgIGNvbnN0IHZhbGlkVGV4dE5vZGVzID0gdGV4dE5vZGVzLmZpbHRlcihpc1RhZ2dhYmxlVGV4dE5vZGUpO1xuXG4gICAgICB2YWxpZFRleHROb2Rlcy5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgICAgICBjb25zdCB0ZXh0Tm9kZUluZGV4ID0gdGV4dE5vZGVzLmluZGV4T2YoY2hpbGQpICsgMTtcblxuICAgICAgICBjb25zdCBvcmlnaW5hbFRleHRDb250ZW50ID0gY2hpbGQudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCBudWxsO1xuXG4gICAgICAgIGNvbnN0IHRhZ0RhdGFFbnRyeSA9IGNyZWF0ZUFuZEluc2VydFRhZyhcbiAgICAgICAgICBlbCxcbiAgICAgICAgICB4cGF0aCxcbiAgICAgICAgICB0ZXh0Tm9kZUluZGV4LFxuICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIGNoaWxkLFxuICAgICAgICAgIG9yaWdpbmFsVGV4dENvbnRlbnQsXG4gICAgICAgICk7XG5cbiAgICAgICAgdGFnRGF0YUxpc3QucHVzaCh0YWdEYXRhRW50cnkpO1xuICAgICAgICBpZE51bSsrO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgdGFnRGF0YURpY3Q6IHsgW2tleTogbnVtYmVyXTogVGFnTWV0YWRhdGEgfSA9IHt9O1xuICB0YWdEYXRhTGlzdC5mb3JFYWNoKCh0YWdEYXRhKSA9PiB7XG4gICAgY29uc3QgZWxlbWVudEhUTUwgPSBnZXRPcGVuaW5nVGFnKHRhZ0RhdGEuZWxlbWVudCk7XG4gICAgY29uc3Qgc3ltYm9sID0gZ2V0VGFnU3ltYm9sKHRhZ0RhdGEuZWxlbWVudCkgfHwgXCJcIjtcbiAgICBjb25zdCBpZFN0cmluZyA9IGBbICR7c3ltYm9sfSR7c3ltYm9sID8gXCIgXCIgOiBcIlwifSR7dGFnRGF0YS50YXJzaWVySWR9IF1gO1xuXG4gICAgY29uc3QgZWxlbWVudFRleHQgPSB0YWdEYXRhLm9yaWdpbmFsVGV4dENvbnRlbnQ7XG5cbiAgICB0YWdEYXRhRGljdFt0YWdEYXRhLnRhcnNpZXJJZF0gPSB7XG4gICAgICB0YXJzaWVySWQ6IHRhZ0RhdGEudGFyc2llcklkLFxuICAgICAgZWxlbWVudE5hbWU6IHRhZ0RhdGEuZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCksXG4gICAgICBvcGVuaW5nVGFnSFRNTDogZWxlbWVudEhUTUwsXG4gICAgICB4cGF0aDogdGFnRGF0YS54cGF0aCxcbiAgICAgIGVsZW1lbnRUZXh0OiBlbGVtZW50VGV4dCxcbiAgICAgIHRleHROb2RlSW5kZXg6IHRhZ0RhdGEudGV4dE5vZGVJbmRleCxcbiAgICAgIGlkU3ltYm9sOiBzeW1ib2wsXG4gICAgICBpZFN0cmluZzogaWRTdHJpbmcsXG4gICAgfTtcbiAgfSk7XG4gIHJldHVybiB0YWdEYXRhRGljdDtcbn1cblxuZnVuY3Rpb24gYWJzb2x1dGVseVBvc2l0aW9uVGFnSWZNaXNhbGlnbmVkKFxuICB0YWc6IEhUTUxFbGVtZW50LFxuICByZWZlcmVuY2U6IEhUTUxFbGVtZW50LFxuKSB7XG4gIC8qXG4gIFNvbWUgdGFncyBkb24ndCBnZXQgZGlzcGxheWVkIG9uIHRoZSBwYWdlIHByb3Blcmx5XG4gIFRoaXMgb2NjdXJzIGlmIHRoZSBwYXJlbnQgZWxlbWVudCBjaGlsZHJlbiBhcmUgZGlzam9pbnRlZCBmcm9tIHRoZSBwYXJlbnRcbiAgSW4gdGhpcyBjYXNlLCB3ZSBhYnNvbHV0ZWx5IHBvc2l0aW9uIHRoZSB0YWcgdG8gdGhlIHBhcmVudCBlbGVtZW50XG4gICovXG5cbiAgbGV0IHRhZ1JlY3QgPSB0YWcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIGlmICghKHRhZ1JlY3Qud2lkdGggPT09IDAgfHwgdGFnUmVjdC5oZWlnaHQgPT09IDApKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZGlzdGFuY2VUaHJlc2hvbGQgPSAyNTA7XG5cbiAgLy8gQ2hlY2sgaWYgdGhlIGV4cGVjdGVkIHBvc2l0aW9uIGlzIG9mZi1zY3JlZW4gaG9yaXpvbnRhbGx5XG4gIGNvbnN0IGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0ID0gcmVmZXJlbmNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBpZiAoXG4gICAgZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QucmlnaHQgPCAwIHx8XG4gICAgZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QubGVmdCA+XG4gICAgICAod2luZG93LmlubmVyV2lkdGggfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoKVxuICApIHtcbiAgICAvLyBFeHBlY3RlZCBwb3NpdGlvbiBpcyBvZmYtc2NyZWVuIGhvcml6b250YWxseSwgcmVtb3ZlIHRoZSB0YWdcbiAgICB0YWcucmVtb3ZlKCk7XG4gICAgcmV0dXJuOyAvLyBTa2lwIHRvIHRoZSBuZXh0IHRhZ1xuICB9XG5cbiAgY29uc3QgcmVmZXJlbmNlVG9wTGVmdCA9IHtcbiAgICB4OiBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC5sZWZ0LFxuICAgIHk6IGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LnRvcCxcbiAgfTtcblxuICBjb25zdCB0YWdDZW50ZXIgPSB7XG4gICAgeDogKHRhZ1JlY3QubGVmdCArIHRhZ1JlY3QucmlnaHQpIC8gMixcbiAgICB5OiAodGFnUmVjdC50b3AgKyB0YWdSZWN0LmJvdHRvbSkgLyAyLFxuICB9O1xuXG4gIGNvbnN0IGR4ID0gTWF0aC5hYnMocmVmZXJlbmNlVG9wTGVmdC54IC0gdGFnQ2VudGVyLngpO1xuICBjb25zdCBkeSA9IE1hdGguYWJzKHJlZmVyZW5jZVRvcExlZnQueSAtIHRhZ0NlbnRlci55KTtcbiAgaWYgKGR4ID4gZGlzdGFuY2VUaHJlc2hvbGQgfHwgZHkgPiBkaXN0YW5jZVRocmVzaG9sZCB8fCAhZWxJc1Zpc2libGUodGFnKSkge1xuICAgIHRhZy5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcblxuICAgIC8vIEVuc3VyZSB0aGUgdGFnIGlzIHBvc2l0aW9uZWQgd2l0aGluIHRoZSBzY3JlZW4gYm91bmRzXG4gICAgbGV0IGxlZnRQb3NpdGlvbiA9IE1hdGgubWF4KFxuICAgICAgMCxcbiAgICAgIGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LmxlZnQgLSAodGFnUmVjdC5yaWdodCArIDMgLSB0YWdSZWN0LmxlZnQpLFxuICAgICk7XG4gICAgbGVmdFBvc2l0aW9uID0gTWF0aC5taW4oXG4gICAgICBsZWZ0UG9zaXRpb24sXG4gICAgICB3aW5kb3cuaW5uZXJXaWR0aCAtICh0YWdSZWN0LnJpZ2h0IC0gdGFnUmVjdC5sZWZ0KSxcbiAgICApO1xuICAgIGxldCB0b3BQb3NpdGlvbiA9IE1hdGgubWF4KDAsIGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LnRvcCArIDMpOyAvLyBBZGQgc29tZSB0b3AgYnVmZmVyIHRvIGNlbnRlciBhbGlnbiBiZXR0ZXJcbiAgICB0b3BQb3NpdGlvbiA9IE1hdGgubWluKFxuICAgICAgdG9wUG9zaXRpb24sXG4gICAgICBNYXRoLm1heCh3aW5kb3cuaW5uZXJIZWlnaHQsIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxIZWlnaHQpIC1cbiAgICAgICAgKHRhZ1JlY3QuYm90dG9tIC0gdGFnUmVjdC50b3ApLFxuICAgICk7XG5cbiAgICB0YWcuc3R5bGUubGVmdCA9IGAke2xlZnRQb3NpdGlvbn1weGA7XG4gICAgdGFnLnN0eWxlLnRvcCA9IGAke3RvcFBvc2l0aW9ufXB4YDtcblxuICAgIHRhZy5wYXJlbnRFbGVtZW50ICYmIHRhZy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRhZyk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0YWcpO1xuICB9XG59XG5cbmNvbnN0IHNocmlua0NvbGxpZGluZ1RhZ3MgPSAoKSA9PiB7XG4gIGNvbnN0IHRhZ3MgPSBBcnJheS5mcm9tKFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFyc2llclNlbGVjdG9yKSxcbiAgKSBhcyBIVE1MRWxlbWVudFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0YWcgPSB0YWdzW2ldO1xuICAgIGxldCB0YWdSZWN0ID0gdGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGxldCBmb250U2l6ZSA9IHBhcnNlRmxvYXQoXG4gICAgICB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0YWcpLmZvbnRTaXplLnNwbGl0KFwicHhcIilbMF0sXG4gICAgKTtcblxuICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHRhZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgIGNvbnN0IG90aGVyVGFnID0gdGFnc1tqXTtcbiAgICAgIGxldCBvdGhlclRhZ1JlY3QgPSBvdGhlclRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGxldCBvdGhlckZvbnRTaXplID0gcGFyc2VGbG9hdChcbiAgICAgICAgd2luZG93LmdldENvbXB1dGVkU3R5bGUob3RoZXJUYWcpLmZvbnRTaXplLnNwbGl0KFwicHhcIilbMF0sXG4gICAgICApO1xuXG4gICAgICB3aGlsZSAoXG4gICAgICAgIHRhZ1JlY3QubGVmdCA8IG90aGVyVGFnUmVjdC5yaWdodCAmJlxuICAgICAgICB0YWdSZWN0LnJpZ2h0ID4gb3RoZXJUYWdSZWN0LmxlZnQgJiZcbiAgICAgICAgdGFnUmVjdC50b3AgPCBvdGhlclRhZ1JlY3QuYm90dG9tICYmXG4gICAgICAgIHRhZ1JlY3QuYm90dG9tID4gb3RoZXJUYWdSZWN0LnRvcCAmJlxuICAgICAgICBmb250U2l6ZSA+IE1JTl9GT05UX1NJWkUgJiZcbiAgICAgICAgb3RoZXJGb250U2l6ZSA+IE1JTl9GT05UX1NJWkVcbiAgICAgICkge1xuICAgICAgICBmb250U2l6ZSAtPSAwLjU7XG4gICAgICAgIG90aGVyRm9udFNpemUgLT0gMC41O1xuICAgICAgICB0YWcuc3R5bGUuZm9udFNpemUgPSBgJHtmb250U2l6ZX1weGA7XG4gICAgICAgIG90aGVyVGFnLnN0eWxlLmZvbnRTaXplID0gYCR7b3RoZXJGb250U2l6ZX1weGA7XG5cbiAgICAgICAgdGFnUmVjdCA9IHRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgb3RoZXJUYWdSZWN0ID0gb3RoZXJUYWcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuXG53aW5kb3cucmVtb3ZlVGFncyA9ICgpID0+IHtcbiAgZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpXG4gICAgLmZpbHRlcigoZWxlbWVudCkgPT4gZWxlbWVudC5tYXRjaGVzKHRhcnNpZXJTZWxlY3RvcikpXG4gICAgLmZvckVhY2goKHRhZykgPT4gdGFnLnJlbW92ZSgpKTtcblxuICBzaG93TWFwRWxlbWVudHMoKTtcbn07XG5cbmNvbnN0IEdPT0dMRV9NQVBTX09QQUNJVFlfQ09OVFJPTCA9IFwiX19yZXdvcmtkX2dvb2dsZV9tYXBzX29wYWNpdHlcIjtcblxuY29uc3QgaGlkZU1hcEVsZW1lbnRzID0gKCk6IHZvaWQgPT4ge1xuICAvLyBNYXBzIGhhdmUgbG90cyBvZiB0aW55IGJ1dHRvbnMgdGhhdCBuZWVkIHRvIGJlIHRhZ2dlZFxuICAvLyBUaGV5IGFsc28gaGF2ZSBhIGxvdCBvZiB0aW55IHRleHQgYW5kIGFyZSBhbm5veWluZyB0byBkZWFsIHdpdGggZm9yIHJlbmRlcmluZ1xuICAvLyBBbHNvIGFueSBlbGVtZW50IHdpdGggYXJpYS1sYWJlbD1cIk1hcFwiIGFyaWEtcm9sZWRlc2NyaXB0aW9uPVwibWFwXCJcbiAgY29uc3Qgc2VsZWN0b3JzID0gW1xuICAgICdpZnJhbWVbc3JjKj1cImdvb2dsZS5jb20vbWFwc1wiXScsXG4gICAgJ2lmcmFtZVtpZCo9XCJnbWFwX2NhbnZhc1wiXScsXG4gICAgXCIubWFwbGlicmVnbC1tYXBcIixcbiAgICBcIi5tYXBib3hnbC1tYXBcIixcbiAgICBcIi5sZWFmbGV0LWNvbnRhaW5lclwiLFxuICAgICdpbWdbc3JjKj1cIm1hcHMuZ29vZ2xlYXBpcy5jb21cIl0nLFxuICAgICdbYXJpYS1sYWJlbD1cIk1hcFwiXScsXG4gICAgXCIuY21wLWxvY2F0aW9uLW1hcF9fbWFwXCIsXG4gICAgJy5tYXAtdmlld1tkYXRhLXJvbGU9XCJtYXBWaWV3XCJdJyxcbiAgICBcIi5nb29nbGVfTWFwLXdyYXBwZXJcIixcbiAgICBcIi5nb29nbGVfbWFwLXdyYXBwZXJcIixcbiAgICBcIi5nb29nbGVNYXAtd3JhcHBlclwiLFxuICAgIFwiLmdvb2dsZW1hcC13cmFwcGVyXCIsXG4gICAgXCIubHMtbWFwLWNhbnZhc1wiLFxuICAgIFwiLmdtYXBjbHVzdGVyXCIsXG4gICAgXCIjZ29vZ2xlTWFwXCIsXG4gICAgXCIjZ29vZ2xlTWFwc1wiLFxuICAgIFwiI2dvb2dsZW1hcHNcIixcbiAgICBcIiNnb29nbGVtYXBcIixcbiAgICBcIiNnb29nbGVfbWFwXCIsXG4gICAgXCIjZ29vZ2xlX21hcHNcIixcbiAgICBcIiNNYXBJZFwiLFxuICAgIFwiLmdlb2xvY2F0aW9uLW1hcC13cmFwcGVyXCIsXG4gICAgXCIubG9jYXRvck1hcFwiLFxuICBdO1xuXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3JzLmpvaW4oXCIsIFwiKSkuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xuICAgIGNvbnN0IGN1cnJlbnRPcGFjaXR5ID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkub3BhY2l0eTtcbiAgICAvLyBTdG9yZSBjdXJyZW50IG9wYWNpdHlcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtb3JpZ2luYWwtb3BhY2l0eVwiLCBjdXJyZW50T3BhY2l0eSk7XG5cbiAgICAoZWxlbWVudCBhcyBIVE1MRWxlbWVudCkuc3R5bGUub3BhY2l0eSA9IFwiMFwiO1xuICB9KTtcbn07XG5cbmNvbnN0IHNob3dNYXBFbGVtZW50cyA9ICgpID0+IHtcbiAgY29uc3QgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxuICAgIGBbJHtHT09HTEVfTUFQU19PUEFDSVRZX0NPTlRST0x9XWAsXG4gICk7XG4gIGVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAoZWxlbWVudCBhcyBIVE1MRWxlbWVudCkuc3R5bGUub3BhY2l0eSA9XG4gICAgICBlbGVtZW50LmdldEF0dHJpYnV0ZShcImRhdGEtb3JpZ2luYWwtb3BhY2l0eVwiKSB8fCBcIjFcIjtcbiAgfSk7XG59O1xuXG53aW5kb3cuaGlkZU5vblRhZ0VsZW1lbnRzID0gKCkgPT4ge1xuICBjb25zdCBhbGxFbGVtZW50cyA9IGdldEFsbEVsZW1lbnRzSW5BbGxGcmFtZXMoKTtcbiAgYWxsRWxlbWVudHMuZm9yRWFjaCgoZWwpID0+IHtcbiAgICBjb25zdCBlbGVtZW50ID0gZWwgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICBpZiAoZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5KSB7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcbiAgICAgICAgcmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUsXG4gICAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFlbGVtZW50LmlkLnN0YXJ0c1dpdGgodGFyc2llcklkKSkge1xuICAgICAgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gXCJ2aXNpYmxlXCI7XG4gICAgfVxuICB9KTtcbn07XG5cbndpbmRvdy5maXhOYW1lc3BhY2VzID0gKHRhZ05hbWU6IHN0cmluZyk6IHN0cmluZyA9PiB7XG4gIC8vIE5hbWVzcGFjZXMgaW4gWE1MIGdpdmUgZWxlbWVudHMgdW5pcXVlIHByZWZpeGVzIChlLmcuLCBcImE6dGFnXCIpLlxuICAvLyBTdGFuZGFyZCBYUGF0aCB3aXRoIG5hbWVzcGFjZXMgY2FuIGZhaWwgdG8gZmluZCBlbGVtZW50cy5cbiAgLy8gVGhlIGBuYW1lKClgIGZ1bmN0aW9uIHJldHVybnMgdGhlIGZ1bGwgZWxlbWVudCBuYW1lLCBpbmNsdWRpbmcgdGhlIHByZWZpeC5cbiAgLy8gVXNpbmcgXCIvKltuYW1lKCk9J2E6dGFnJ11cIiBlbnN1cmVzIHRoZSBYUGF0aCBtYXRjaGVzIHRoZSBlbGVtZW50IGNvcnJlY3RseS5cbiAgY29uc3QgdmFsaWROYW1lc3BhY2VUYWcgPSAvXlthLXpBLVpfXVtcXHdcXC0uXSo6W2EtekEtWl9dW1xcd1xcLS5dKiQvO1xuXG4gIC8vIFNwbGl0IHRoZSB0YWdOYW1lIGJ5ICcjJyAoSUQpIGFuZCAnLicgKGNsYXNzKSB0byBpc29sYXRlIHRoZSB0YWcgbmFtZSBwYXJ0XG4gIGNvbnN0IHRhZ09ubHkgPSB0YWdOYW1lLnNwbGl0KC9bIy5dLylbMF07XG5cbiAgaWYgKHZhbGlkTmFtZXNwYWNlVGFnLnRlc3QodGFnT25seSkpIHtcbiAgICAvLyBJZiBpdCdzIGEgdmFsaWQgbmFtZXNwYWNlZCB0YWcsIHdyYXAgd2l0aCB0aGUgbmFtZSgpIGZ1bmN0aW9uXG4gICAgcmV0dXJuIHRhZ05hbWUucmVwbGFjZSh0YWdPbmx5LCBgKltuYW1lKCk9XCIke3RhZ09ubHl9XCJdYCk7XG4gIH1cblxuICByZXR1cm4gdGFnTmFtZTtcbn07XG5cbndpbmRvdy5yZXZlcnRWaXNpYmlsaXRpZXMgPSAoKSA9PiB7XG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpO1xuICBhbGxFbGVtZW50cy5mb3JFYWNoKChlbCkgPT4ge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBlbCBhcyBIVE1MRWxlbWVudDtcbiAgICBpZiAoZWxlbWVudC5nZXRBdHRyaWJ1dGUocmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUpKSB7XG4gICAgICBlbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPVxuICAgICAgICBlbGVtZW50LmdldEF0dHJpYnV0ZShyZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSkgfHwgXCJ0cnVlXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsZW1lbnQuc3R5bGUucmVtb3ZlUHJvcGVydHkoXCJ2aXNpYmlsaXR5XCIpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5mdW5jdGlvbiBoYXNEaXJlY3RUZXh0Q29udGVudChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICBjb25zdCBjaGlsZE5vZGVzQXJyYXkgPSBBcnJheS5mcm9tKGVsZW1lbnQuY2hpbGROb2Rlcyk7XG4gIGZvciAobGV0IG5vZGUgb2YgY2hpbGROb2Rlc0FycmF5KSB7XG4gICAgaWYgKFxuICAgICAgbm9kZS5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUgJiZcbiAgICAgIG5vZGUudGV4dENvbnRlbnQgJiZcbiAgICAgIG5vZGUudGV4dENvbnRlbnQudHJpbSgpLmxlbmd0aCA+IDBcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbndpbmRvdy5oaWRlTm9uQ29sb3VyZWRFbGVtZW50cyA9ICgpID0+IHtcbiAgY29uc3QgYWxsRWxlbWVudHMgPSBkb2N1bWVudC5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpO1xuICBhbGxFbGVtZW50cy5mb3JFYWNoKChlbCkgPT4ge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBlbCBhcyBIVE1MRWxlbWVudDtcbiAgICBpZiAoZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5KSB7XG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcbiAgICAgICAgcmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUsXG4gICAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgIWVsZW1lbnQuaGFzQXR0cmlidXRlKFwiZGF0YS1jb2xvcmVkXCIpIHx8XG4gICAgICBlbGVtZW50LmdldEF0dHJpYnV0ZShcImRhdGEtY29sb3JlZFwiKSAhPT0gXCJ0cnVlXCJcbiAgICApIHtcbiAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9IFwidmlzaWJsZVwiO1xuICAgIH1cbiAgfSk7XG59O1xuXG5mdW5jdGlvbiBnZXROZXh0Q29sb3JzKHRvdGFsVGFnczogbnVtYmVyKTogc3RyaW5nW10ge1xuICBsZXQgY29sb3JzID0gW107XG4gIGxldCBzdGVwID0gTWF0aC5jZWlsKDI1NiAvIE1hdGguY2JydCh0b3RhbFRhZ3MpKTsgLy8gU3RhcnQgd2l0aCB0aGUgaW5pdGlhbCBzdGVwIHNpemVcblxuICB3aGlsZSAoY29sb3JzLmxlbmd0aCA8IHRvdGFsVGFncykge1xuICAgIGNvbG9ycyA9IFtdOyAvLyBSZXNldCB0aGUgY29sb3JzIGFycmF5IGZvciBlYWNoIGl0ZXJhdGlvblxuICAgIGZvciAobGV0IHIgPSAwOyByIDwgMjU2OyByICs9IHN0ZXApIHtcbiAgICAgIGZvciAobGV0IGcgPSAwOyBnIDwgMjU2OyBnICs9IHN0ZXApIHtcbiAgICAgICAgZm9yIChsZXQgYiA9IDA7IGIgPCAyNTY7IGIgKz0gc3RlcCkge1xuICAgICAgICAgIGNvbG9ycy5wdXNoKGByZ2IoJHtyfSwgJHtnfSwgJHtifSlgKTtcbiAgICAgICAgICBpZiAoY29sb3JzLmxlbmd0aCA+PSB0b3RhbFRhZ3MpIHtcbiAgICAgICAgICAgIC8vIFN0b3AgZ2VuZXJhdGluZyBjb2xvcnMgb25jZSB3ZSByZWFjaCB0aGUgcmVxdWlyZWQgYW1vdW50XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbG9ycy5sZW5ndGggPj0gdG90YWxUYWdzKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChjb2xvcnMubGVuZ3RoID49IHRvdGFsVGFncykge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29sb3JzLmxlbmd0aCA8IHRvdGFsVGFncykge1xuICAgICAgc3RlcC0tOyAvLyBEZWNyZWFzZSB0aGUgc3RlcCB0byBpbmNyZWFzZSB0aGUgbnVtYmVyIG9mIGdlbmVyYXRlZCBjb2xvcnNcbiAgICAgIGlmIChzdGVwIDw9IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiU3RlcCBjYW5ub3QgYmUgcmVkdWNlZCBmdXJ0aGVyLlwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmb3IgKGxldCBpID0gY29sb3JzLmxlbmd0aCAtIDE7IGkgPiAwOyBpLS0pIHtcbiAgICBjb25zdCBqID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKGkgKyAxKSk7XG4gICAgW2NvbG9yc1tpXSwgY29sb3JzW2pdXSA9IFtjb2xvcnNbal0sIGNvbG9yc1tpXV07XG4gIH1cblxuICByZXR1cm4gY29sb3JzLnNsaWNlKDAsIHRvdGFsVGFncyk7XG59XG5cbmZ1bmN0aW9uIGNvbG9yRGlzdGFuY2UoY29sb3IxOiBzdHJpbmcsIGNvbG9yMjogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgcmdiMSA9IGNvbG9yMS5tYXRjaCgvXFxkKy9nKSEubWFwKE51bWJlcik7XG4gIGNvbnN0IHJnYjIgPSBjb2xvcjIubWF0Y2goL1xcZCsvZykhLm1hcChOdW1iZXIpO1xuICByZXR1cm4gTWF0aC5zcXJ0KFxuICAgIE1hdGgucG93KHJnYjFbMF0gLSByZ2IyWzBdLCAyKSArXG4gICAgICBNYXRoLnBvdyhyZ2IxWzFdIC0gcmdiMlsxXSwgMikgK1xuICAgICAgTWF0aC5wb3cocmdiMVsyXSAtIHJnYjJbMl0sIDIpLFxuICApO1xufVxuXG5mdW5jdGlvbiBhc3NpZ25Db2xvcnMoXG4gIGVsZW1lbnRzOiBIVE1MRWxlbWVudFtdLFxuICBjb2xvcnM6IHN0cmluZ1tdLFxuKTogTWFwPEhUTUxFbGVtZW50LCBzdHJpbmc+IHtcbiAgY29uc3QgY29sb3JBc3NpZ25tZW50cyA9IG5ldyBNYXA8SFRNTEVsZW1lbnQsIHN0cmluZz4oKTtcbiAgY29uc3QgYXNzaWduZWRDb2xvcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBlbGVtZW50cy5mb3JFYWNoKChlbGVtZW50KSA9PiB7XG4gICAgbGV0IGJlc3RDb2xvcjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IG1heE1pbkRpc3RhbmNlID0gLTE7XG5cbiAgICBjb2xvcnMuZm9yRWFjaCgoY29sb3IpID0+IHtcbiAgICAgIGlmIChhc3NpZ25lZENvbG9ycy5oYXMoY29sb3IpKSByZXR1cm47XG5cbiAgICAgIGxldCBtaW5EaXN0YW5jZSA9IEluZmluaXR5O1xuICAgICAgYXNzaWduZWRDb2xvcnMuZm9yRWFjaCgoYXNzaWduZWRDb2xvcikgPT4ge1xuICAgICAgICBjb25zdCBkaXN0YW5jZSA9IGNvbG9yRGlzdGFuY2UoY29sb3IsIGFzc2lnbmVkQ29sb3IpO1xuICAgICAgICBtaW5EaXN0YW5jZSA9IE1hdGgubWluKG1pbkRpc3RhbmNlLCBkaXN0YW5jZSk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKG1pbkRpc3RhbmNlID4gbWF4TWluRGlzdGFuY2UpIHtcbiAgICAgICAgbWF4TWluRGlzdGFuY2UgPSBtaW5EaXN0YW5jZTtcbiAgICAgICAgYmVzdENvbG9yID0gY29sb3I7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoYmVzdENvbG9yKSB7XG4gICAgICBjb2xvckFzc2lnbm1lbnRzLnNldChlbGVtZW50LCBiZXN0Q29sb3IpO1xuICAgICAgYXNzaWduZWRDb2xvcnMuYWRkKGJlc3RDb2xvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZhbGxiYWNrOiBBc3NpZ24gdGhlIGZpcnN0IHVuYXNzaWduZWQgY29sb3IgaWYgbm8gYmVzdENvbG9yIGlzIGZvdW5kXG4gICAgICBjb25zdCByZW1haW5pbmdDb2xvcnMgPSBjb2xvcnMuZmlsdGVyKChjKSA9PiAhYXNzaWduZWRDb2xvcnMuaGFzKGMpKTtcbiAgICAgIGJlc3RDb2xvciA9IHJlbWFpbmluZ0NvbG9yc1swXTtcbiAgICAgIGNvbG9yQXNzaWdubWVudHMuc2V0KGVsZW1lbnQsIGJlc3RDb2xvcik7XG4gICAgICBhc3NpZ25lZENvbG9ycy5hZGQoYmVzdENvbG9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjb2xvckFzc2lnbm1lbnRzO1xufVxuXG53aW5kb3cuY29sb3VyQmFzZWRUYWdpZnkgPSAoXG4gIHRhZ0xlYWZUZXh0cyA9IGZhbHNlLFxuICB0YWdsZXNzOiBib29sZWFuID0gZmFsc2UsXG4pOiB7XG4gIGNvbG9yTWFwcGluZzogQ29sb3VyZWRFbGVtW107XG4gIHRhZ01hcHBpbmdXaXRoVGFnTWV0YTogeyBbcDogbnVtYmVyXTogVGFnTWV0YWRhdGEgfTtcbiAgaW5zZXJ0ZWRJZFN0cmluZ3M6IHN0cmluZ1tdO1xufSA9PiB7XG4gIGNvbnN0IHRhZ01hcHBpbmdXaXRoVGFnTWV0YSA9IHdpbmRvdy50YWdpZnlXZWJwYWdlKHRhZ0xlYWZUZXh0cyk7XG5cbiAgd2luZG93LnJlbW92ZVRhZ3MoKTtcblxuICBjb25zdCBpbnNlcnRlZElkU3RyaW5ncyA9IGluc2VydElkU3RyaW5nc0ludG9UZXh0Tm9kZXMoXG4gICAgdGFnTWFwcGluZ1dpdGhUYWdNZXRhLFxuICAgIHRhZ2xlc3MsXG4gICk7XG5cbiAgY29uc3QgZWxlbWVudHMgPSBjb2xsZWN0RWxlbWVudHNUb0NvbG9yKHRhZ01hcHBpbmdXaXRoVGFnTWV0YSk7XG5cbiAgY29uc3QgY29sb3JBc3NpZ25tZW50cyA9IGdldENvbG9yc0ZvckVsZW1lbnRzKGVsZW1lbnRzKTtcblxuICBjb25zdCBjb2xvck1hcHBpbmcgPSBjcmVhdGVDb2xvck1hcHBpbmdBbmRBcHBseVN0eWxlcyhcbiAgICBlbGVtZW50cyxcbiAgICBjb2xvckFzc2lnbm1lbnRzLFxuICAgIHRhZ01hcHBpbmdXaXRoVGFnTWV0YSxcbiAgKTtcblxuICByZXR1cm4geyBjb2xvck1hcHBpbmcsIHRhZ01hcHBpbmdXaXRoVGFnTWV0YSwgaW5zZXJ0ZWRJZFN0cmluZ3MgfTtcbn07XG5cbmZ1bmN0aW9uIGluc2VydElkU3RyaW5nc0ludG9UZXh0Tm9kZXMoXG4gIHRhZ01hcHBpbmdXaXRoVGFnTWV0YTogeyBba2V5OiBudW1iZXJdOiBUYWdNZXRhZGF0YSB9LFxuICB0YWdsZXNzOiBib29sZWFuLFxuKTogc3RyaW5nW10ge1xuICBsZXQgaW5zZXJ0ZWRJZFN0cmluZ3M6IHN0cmluZ1tdID0gW107XG4gIE9iamVjdC5lbnRyaWVzKHRhZ01hcHBpbmdXaXRoVGFnTWV0YSkuZm9yRWFjaCgoW2lkLCBtZXRhXSkgPT4ge1xuICAgIGlmIChtZXRhLnRleHROb2RlSW5kZXggIT09IHVuZGVmaW5lZCAmJiBtZXRhLmlkU3RyaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IHhwYXRoV2l0aFRleHROb2RlID0gYCR7bWV0YS54cGF0aH0vdGV4dCgpWyR7bWV0YS50ZXh0Tm9kZUluZGV4fV1gO1xuICAgICAgY29uc3QgdGV4dE5vZGUgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgICAgeHBhdGhXaXRoVGV4dE5vZGUsXG4gICAgICAgIGRvY3VtZW50LFxuICAgICAgICBudWxsLFxuICAgICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgICAgbnVsbCxcbiAgICAgICkuc2luZ2xlTm9kZVZhbHVlIGFzIFRleHQ7XG5cbiAgICAgIGlmICh0ZXh0Tm9kZSAmJiAhdGFnbGVzcykge1xuICAgICAgICB0ZXh0Tm9kZS5kYXRhID0gYCR7bWV0YS5pZFN0cmluZ30gJHt0ZXh0Tm9kZS5kYXRhfWA7XG4gICAgICAgIGluc2VydGVkSWRTdHJpbmdzLnB1c2gobWV0YS5pZFN0cmluZyk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGluc2VydGVkSWRTdHJpbmdzO1xufVxuXG5mdW5jdGlvbiBjb2xsZWN0RWxlbWVudHNUb0NvbG9yKHRhZ01hcHBpbmdXaXRoVGFnTWV0YToge1xuICBba2V5OiBudW1iZXJdOiBUYWdNZXRhZGF0YTtcbn0pOiBIVE1MRWxlbWVudFtdIHtcbiAgY29uc3QgZWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBbXTtcbiAgY29uc3Qgdmlld3BvcnRXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICBPYmplY3QudmFsdWVzKHRhZ01hcHBpbmdXaXRoVGFnTWV0YSkuZm9yRWFjaCgobWV0YSkgPT4ge1xuICAgIGNvbnN0IHsgdGFyc2llcklkOiBpZCwgeHBhdGggfSA9IG1ldGE7XG4gICAgY29uc3Qgbm9kZSA9IGRvY3VtZW50LmV2YWx1YXRlKFxuICAgICAgeHBhdGgsXG4gICAgICBkb2N1bWVudCxcbiAgICAgIG51bGwsXG4gICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgIG51bGwsXG4gICAgKS5zaW5nbGVOb2RlVmFsdWU7XG5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICBjb25zdCBjb21wdXRlZFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShub2RlKTtcbiAgICAgIGlmIChjb21wdXRlZFN0eWxlLmRpc3BsYXkgPT09IFwiY29udGVudHNcIikge1xuICAgICAgICBub2RlLnN0eWxlLnJlbW92ZVByb3BlcnR5KFwiZGlzcGxheVwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlY3QgPSBub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKFxuICAgICAgICByZWN0LndpZHRoID4gMCAmJlxuICAgICAgICByZWN0LmhlaWdodCA+IDAgJiZcbiAgICAgICAgcmVjdC5sZWZ0ID49IDAgJiZcbiAgICAgICAgcmVjdC5yaWdodCA8PSB2aWV3cG9ydFdpZHRoXG4gICAgICApIHtcbiAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkXCIsIGlkLnRvU3RyaW5nKCkpO1xuICAgICAgICBlbGVtZW50cy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG4gIHJldHVybiBlbGVtZW50cztcbn1cblxuZnVuY3Rpb24gZ2V0Q29sb3JzRm9yRWxlbWVudHMoXG4gIGVsZW1lbnRzOiBIVE1MRWxlbWVudFtdLFxuKTogTWFwPEhUTUxFbGVtZW50LCBzdHJpbmc+IHtcbiAgY29uc3QgdG90YWxUYWdzID0gZWxlbWVudHMubGVuZ3RoO1xuICBjb25zdCBjb2xvcnMgPSBnZXROZXh0Q29sb3JzKHRvdGFsVGFncyk7XG4gIGNvbnN0IGNvbG9yQXNzaWdubWVudHMgPSBhc3NpZ25Db2xvcnMoZWxlbWVudHMsIGNvbG9ycyk7XG4gIHJldHVybiBjb2xvckFzc2lnbm1lbnRzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb2xvck1hcHBpbmdBbmRBcHBseVN0eWxlcyhcbiAgZWxlbWVudHM6IEhUTUxFbGVtZW50W10sXG4gIGNvbG9yQXNzaWdubWVudHM6IE1hcDxIVE1MRWxlbWVudCwgc3RyaW5nPixcbiAgdGFnTWFwcGluZ1dpdGhUYWdNZXRhOiB7IFtrZXk6IG51bWJlcl06IFRhZ01ldGFkYXRhIH0sXG4pOiBDb2xvdXJlZEVsZW1bXSB7XG4gIGNvbnN0IGNvbG9yTWFwcGluZzogQ29sb3VyZWRFbGVtW10gPSBbXTtcbiAgY29uc3QgYm9keVJlY3QgPSBkb2N1bWVudC5ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBjb25zdCBhdHRyaWJ1dGUgPSBcImRhdGEtY29sb3JlZFwiO1xuICBjb25zdCB0YWdnZWRFbGVtZW50cyA9IG5ldyBTZXQoXG4gICAgT2JqZWN0LnZhbHVlcyh0YWdNYXBwaW5nV2l0aFRhZ01ldGEpLm1hcCgobWV0YSkgPT4gbWV0YS54cGF0aCksXG4gICk7XG5cbiAgZWxlbWVudHMuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xuICAgIGNvbnN0IGlkID0gcGFyc2VJbnQoZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWlkXCIpISk7XG4gICAgY29uc3QgY29sb3IgPSBjb2xvckFzc2lnbm1lbnRzLmdldChlbGVtZW50KSE7XG4gICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgbWlkcG9pbnQ6IFtudW1iZXIsIG51bWJlcl0gPSBbcmVjdC5sZWZ0LCByZWN0LnRvcF07XG4gICAgY29uc3Qgbm9ybWFsaXplZE1pZHBvaW50OiBbbnVtYmVyLCBudW1iZXJdID0gW1xuICAgICAgKG1pZHBvaW50WzBdIC0gYm9keVJlY3QubGVmdCkgLyBib2R5UmVjdC53aWR0aCxcbiAgICAgIChtaWRwb2ludFsxXSAtIGJvZHlSZWN0LnRvcCkgLyBib2R5UmVjdC5oZWlnaHQsXG4gICAgXTtcblxuICAgIGNvbnN0IHN5bWJvbCA9IGdldFRhZ1N5bWJvbChlbGVtZW50KSB8fCBcIlwiO1xuICAgIGNvbnN0IGlkU3ltYm9sID0gYFsgJHtzeW1ib2x9JHtzeW1ib2wgPyBcIiBcIiA6IFwiXCJ9JHtpZH0gXWA7XG5cbiAgICBjb25zdCB7IGlzRml4ZWQsIGZpeGVkUG9zaXRpb24gfSA9IGdldEZpeGVkUG9zaXRpb24oZWxlbWVudCk7XG5cbiAgICBjb2xvck1hcHBpbmcucHVzaCh7XG4gICAgICBpZCxcbiAgICAgIGlkU3ltYm9sLFxuICAgICAgY29sb3IsXG4gICAgICB4cGF0aDogdGFnTWFwcGluZ1dpdGhUYWdNZXRhW2lkXS54cGF0aCxcbiAgICAgIG1pZHBvaW50LFxuICAgICAgbm9ybWFsaXplZE1pZHBvaW50LFxuICAgICAgd2lkdGg6IHJlY3Qud2lkdGgsXG4gICAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0LFxuICAgICAgaXNGaXhlZCxcbiAgICAgIGZpeGVkUG9zaXRpb24sXG4gICAgICBib3VuZGluZ0JveFg6IHJlY3QueCxcbiAgICAgIGJvdW5kaW5nQm94WTogcmVjdC55LFxuICAgIH0pO1xuXG4gICAgYXBwbHlTdHlsZXNUb0VsZW1lbnQoZWxlbWVudCwgY29sb3IsIGF0dHJpYnV0ZSwgdGFnZ2VkRWxlbWVudHMsIHJlY3QpO1xuICB9KTtcbiAgcmV0dXJuIGNvbG9yTWFwcGluZztcbn1cblxuZnVuY3Rpb24gYXBwbHlTdHlsZXNUb0VsZW1lbnQoXG4gIGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuICBjb2xvcjogc3RyaW5nLFxuICBhdHRyaWJ1dGU6IHN0cmluZyxcbiAgdGFnZ2VkRWxlbWVudHM6IFNldDxzdHJpbmc+LFxuICByZWN0OiBET01SZWN0LFxuKSB7XG4gIGlmIChcbiAgICBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJpbnB1dFwiICYmXG4gICAgKGVsZW1lbnQgYXMgSFRNTElucHV0RWxlbWVudCkudHlwZSA9PT0gXCJjaGVja2JveFwiXG4gICkge1xuICAgIGFwcGx5U3R5bGVzVG9DaGVja2JveChlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQsIGNvbG9yLCBhdHRyaWJ1dGUpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImltZ1wiKSB7XG4gICAgYXBwbHlTdHlsZXNUb0ltYWdlKGVsZW1lbnQgYXMgSFRNTEltYWdlRWxlbWVudCwgY29sb3IsIGF0dHJpYnV0ZSk7XG4gIH0gZWxzZSB7XG4gICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImJhY2tncm91bmQtY29sb3JcIiwgY29sb3IsIFwiaW1wb3J0YW50XCIpO1xuICAgIGVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJjb2xvclwiLCBjb2xvciwgXCJpbXBvcnRhbnRcIik7XG4gICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImJvcmRlci1jb2xvclwiLCBjb2xvciwgXCJpbXBvcnRhbnRcIik7XG4gICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcIm9wYWNpdHlcIiwgXCIxXCIsIFwiaW1wb3J0YW50XCIpO1xuICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGF0dHJpYnV0ZSwgXCJ0cnVlXCIpO1xuICB9XG5cbiAgaWYgKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImFcIikge1xuICAgIGFwcGx5U3R5bGVzVG9MaW5rKGVsZW1lbnQsIHRhZ2dlZEVsZW1lbnRzLCByZWN0KTtcbiAgfVxuXG4gIC8vIEhpZGUgdW50YWdnZWQgY2hpbGQgZWxlbWVudHNcbiAgQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkcmVuKS5mb3JFYWNoKChjaGlsZCkgPT4ge1xuICAgIGNvbnN0IGNoaWxkWHBhdGggPSBnZXRFbGVtZW50WFBhdGgoY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xuICAgIGNvbnN0IGNoaWxkQ29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGNoaWxkKTtcbiAgICBpZiAoXG4gICAgICAhdGFnZ2VkRWxlbWVudHMuaGFzKGNoaWxkWHBhdGgpICYmXG4gICAgICBjaGlsZENvbXB1dGVkU3R5bGUuZGlzcGxheSAhPT0gXCJub25lXCJcbiAgICApIHtcbiAgICAgIChjaGlsZCBhcyBIVE1MRWxlbWVudCkuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwbHlTdHlsZXNUb0NoZWNrYm94KFxuICBjaGVja2JveEVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQsXG4gIGNvbG9yOiBzdHJpbmcsXG4gIGF0dHJpYnV0ZTogc3RyaW5nLFxuKSB7XG4gIGNvbnN0IG9yaWdpbmFsV2lkdGggPSBjaGVja2JveEVsZW1lbnQub2Zmc2V0V2lkdGggKyAyICsgXCJweFwiO1xuICBjb25zdCBvcmlnaW5hbEhlaWdodCA9IGNoZWNrYm94RWxlbWVudC5vZmZzZXRIZWlnaHQgKyAyICsgXCJweFwiO1xuXG4gIC8vIEFwcGx5IHN0eWxlcyB0byBtYWtlIHRoZSBjaGVja2JveCBhcHBlYXIgZmlsbGVkXG4gIGNoZWNrYm94RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcIndpZHRoXCIsIG9yaWdpbmFsV2lkdGgsIFwiaW1wb3J0YW50XCIpO1xuICBjaGVja2JveEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJoZWlnaHRcIiwgb3JpZ2luYWxIZWlnaHQsIFwiaW1wb3J0YW50XCIpO1xuICBjaGVja2JveEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoXCJiYWNrZ3JvdW5kLWNvbG9yXCIsIGNvbG9yLCBcImltcG9ydGFudFwiKTtcbiAgY2hlY2tib3hFbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFxuICAgIFwiYm9yZGVyXCIsXG4gICAgYDJweCBzb2xpZCAke2NvbG9yfWAsXG4gICAgXCJpbXBvcnRhbnRcIixcbiAgKTtcbiAgY2hlY2tib3hFbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiYXBwZWFyYW5jZVwiLCBcIm5vbmVcIiwgXCJpbXBvcnRhbnRcIik7XG4gIGNoZWNrYm94RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImJvcmRlci1yYWRpdXNcIiwgXCI0cHhcIiwgXCJpbXBvcnRhbnRcIik7XG4gIGNoZWNrYm94RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcInBvc2l0aW9uXCIsIFwicmVsYXRpdmVcIiwgXCJpbXBvcnRhbnRcIik7XG4gIGNoZWNrYm94RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImN1cnNvclwiLCBcInBvaW50ZXJcIiwgXCJpbXBvcnRhbnRcIik7XG4gIGNoZWNrYm94RWxlbWVudC5zZXRBdHRyaWJ1dGUoYXR0cmlidXRlLCBcInRydWVcIik7XG5cbiAgLy8gQWRkIGV2ZW50IGxpc3RlbmVyIGZvciBjaGVja2JveCBzdGF0ZSBjaGFuZ2VcbiAgY2hlY2tib3hFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xuICAgIGlmIChjaGVja2JveEVsZW1lbnQuY2hlY2tlZCkge1xuICAgICAgY2hlY2tib3hFbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiYmFja2dyb3VuZC1jb2xvclwiLCBjb2xvciwgXCJpbXBvcnRhbnRcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoZWNrYm94RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImJhY2tncm91bmQtY29sb3JcIiwgY29sb3IsIFwiaW1wb3J0YW50XCIpO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U3R5bGVzVG9JbWFnZShcbiAgZWxlbWVudDogSFRNTEltYWdlRWxlbWVudCxcbiAgY29sb3I6IHN0cmluZyxcbiAgYXR0cmlidXRlOiBzdHJpbmcsXG4pIHtcbiAgY29uc3QgaW1hZ2VXaWR0aCA9IGVsZW1lbnQub2Zmc2V0V2lkdGg7XG4gIGNvbnN0IGltYWdlSGVpZ2h0ID0gZWxlbWVudC5vZmZzZXRIZWlnaHQ7XG5cbiAgY29uc3QgcmdiVG9IZXggPSAocmdiOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSByZ2IubWF0Y2goL1xcZCsvZyk7XG4gICAgcmV0dXJuIHJlc3VsdFxuICAgICAgPyByZXN1bHQubWFwKCh4KSA9PiBwYXJzZUludCh4KS50b1N0cmluZygxNikucGFkU3RhcnQoMiwgXCIwXCIpKS5qb2luKFwiXCIpXG4gICAgICA6IFwiMDAwMDAwXCI7XG4gIH07XG5cbiAgY29uc3QgaGV4Q29sb3IgPSByZ2JUb0hleChjb2xvcik7XG4gIGNvbnN0IG5ld1NyYyA9IGBodHRwczovL2NyYWZ0eXBpeGVscy5jb20vcGxhY2Vob2xkZXItaW1hZ2UvJHtpbWFnZVdpZHRofXgke2ltYWdlSGVpZ2h0fS8ke2hleENvbG9yfS8ke2hleENvbG9yfWA7XG5cbiAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJzcmNcIiwgbmV3U3JjKTtcbiAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoYXR0cmlidXRlLCBcInRydWVcIik7XG59XG5cbmZ1bmN0aW9uIGFwcGx5U3R5bGVzVG9MaW5rKFxuICBlbGVtZW50OiBIVE1MRWxlbWVudCxcbiAgdGFnZ2VkRWxlbWVudHM6IFNldDxzdHJpbmc+LFxuICByZWN0OiBET01SZWN0LFxuKSB7XG4gIGNvbnN0IGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcbiAgaWYgKGNvbXB1dGVkU3R5bGUuYmFja2dyb3VuZEltYWdlICE9PSBcIm5vbmVcIikge1xuICAgIGVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gXCJub25lXCI7XG4gIH1cblxuICBsZXQgaGFzVGV4dENoaWxkID0gZmFsc2U7XG4gIGxldCBoYXNJbWFnZUNoaWxkID0gZmFsc2U7XG4gIGxldCBib3VuZGluZ0JveEdyZWF0ZXJUaGFuWmVybyA9IHJlY3Qud2lkdGggPiAwICYmIHJlY3QuaGVpZ2h0ID4gMDtcbiAgbGV0IGhhc1VuVGFnZ2VkVGV4dEVsZW1lbnQgPSBmYWxzZTtcblxuICAvLyBDaGVjayBmb3IgdGV4dCBub2RlcyBhbmQgaW1hZ2VzIHdpdGhpbiBjaGlsZCBlbGVtZW50c1xuICBBcnJheS5mcm9tKGVsZW1lbnQuY2hpbGRyZW4pLmZvckVhY2goKGNoaWxkKSA9PiB7XG4gICAgY29uc3QgY2hpbGRFbGVtZW50ID0gY2hpbGQgYXMgSFRNTEVsZW1lbnQ7XG4gICAgaWYgKFxuICAgICAgY2hpbGRFbGVtZW50LnRleHRDb250ZW50ICYmXG4gICAgICBjaGlsZEVsZW1lbnQudGV4dENvbnRlbnQudHJpbSgpLmxlbmd0aCA+IDBcbiAgICApIHtcbiAgICAgIGhhc1RleHRDaGlsZCA9IHRydWU7XG4gICAgfVxuICAgIGlmIChjaGlsZEVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImltZ1wiKSB7XG4gICAgICBoYXNJbWFnZUNoaWxkID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gQ2hlY2sgaWYgY2hpbGQgZWxlbWVudCBpdHNlbGYgaXMgbm90IHRhZ2dlZFxuICAgIGNvbnN0IGNoaWxkWHBhdGggPSBnZXRFbGVtZW50WFBhdGgoY2hpbGRFbGVtZW50KTtcbiAgICBpZiAoXG4gICAgICAhdGFnZ2VkRWxlbWVudHMuaGFzKGNoaWxkWHBhdGgpICYmXG4gICAgICBjaGlsZEVsZW1lbnQudGV4dENvbnRlbnQgJiZcbiAgICAgIGNoaWxkRWxlbWVudC50ZXh0Q29udGVudC50cmltKCkubGVuZ3RoID4gMFxuICAgICkge1xuICAgICAgaGFzVW5UYWdnZWRUZXh0RWxlbWVudCA9IHRydWU7XG4gICAgfVxuICB9KTtcblxuICBpZiAoXG4gICAgKCFoYXNUZXh0Q2hpbGQgJiZcbiAgICAgICFoYXNJbWFnZUNoaWxkICYmXG4gICAgICAhaGFzRGlyZWN0VGV4dENvbnRlbnQoZWxlbWVudCkgJiZcbiAgICAgICFib3VuZGluZ0JveEdyZWF0ZXJUaGFuWmVybykgfHxcbiAgICBoYXNVblRhZ2dlZFRleHRFbGVtZW50XG4gICkge1xuICAgIGVsZW1lbnQuc3R5bGUud2lkdGggPSBgJHtyZWN0LndpZHRofXB4YDtcbiAgICBlbGVtZW50LnN0eWxlLmhlaWdodCA9IGAke3JlY3QuaGVpZ2h0fXB4YDtcbiAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlSWRTeW1ib2woaWROdW06IG51bWJlciwgZWw6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGlkU3RyOiBzdHJpbmc7XG4gIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcbiAgICBpZiAoaXNUZXh0SW5zZXJ0YWJsZShlbCkpIGlkU3RyID0gYFsgIyAke2lkTnVtfSBdYDtcbiAgICBlbHNlIGlmIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT0gXCJhXCIpIGlkU3RyID0gYFsgQCAke2lkTnVtfSBdYDtcbiAgICBlbHNlIGlkU3RyID0gYFsgJCAke2lkTnVtfSBdYDtcbiAgfSBlbHNlIHtcbiAgICBpZFN0ciA9IGBbICR7aWROdW19IF1gO1xuICB9XG4gIHJldHVybiBpZFN0cjtcbn1cblxud2luZG93LmNyZWF0ZVRleHRCb3VuZGluZ0JveGVzID0gKCkgPT4ge1xuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG4gIGlmIChzdHlsZS5zaGVldCkge1xuICAgIHN0eWxlLnNoZWV0Lmluc2VydFJ1bGUoXG4gICAgICBgXG4gICAgICAgIC50YXJzaWVyLWhpZ2hsaWdodGVkLXdvcmQsIC50YXJzaWVyLXNwYWNlIHtcbiAgICAgICAgICBib3JkZXI6IDBweCBzb2xpZCBvcmFuZ2U7XG4gICAgICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrICFpbXBvcnRhbnQ7XG4gICAgICAgICAgdmlzaWJpbGl0eTogdmlzaWJsZTtcbiAgICAgICAgfVxuICAgICAgYCxcbiAgICAgIDAsXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5SGlnaGxpZ2h0aW5nKHJvb3Q6IERvY3VtZW50IHwgSFRNTEVsZW1lbnQpIHtcbiAgICByb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJib2R5ICpcIikuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xuICAgICAgaWYgKFxuICAgICAgICBbXCJTQ1JJUFRcIiwgXCJTVFlMRVwiLCBcIklGUkFNRVwiLCBcIklOUFVUXCIsIFwiVEVYVEFSRUFcIl0uaW5jbHVkZXMoXG4gICAgICAgICAgZWxlbWVudC50YWdOYW1lLFxuICAgICAgICApXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgbGV0IGNoaWxkTm9kZXMgPSBBcnJheS5mcm9tKGVsZW1lbnQuY2hpbGROb2Rlcyk7XG4gICAgICBjaGlsZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIG5vZGUubm9kZVR5cGUgPT09IDMgJiZcbiAgICAgICAgICBub2RlLnRleHRDb250ZW50ICYmXG4gICAgICAgICAgbm9kZS50ZXh0Q29udGVudC50cmltKCkubGVuZ3RoID4gMFxuICAgICAgICApIHtcbiAgICAgICAgICBsZXQgdGV4dENvbnRlbnQgPSBub2RlLnRleHRDb250ZW50LnJlcGxhY2UoL1xcdTAwQTAvZywgXCIgXCIpO1xuXG4gICAgICAgICAgY29uc3QgdGFyc2llclRhZ1JlZ2V4ID0gL1xcW1xccyooPzpbJEAjXT9cXHMqXFxkKylcXHMqXFxdL2c7XG5cbiAgICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoXCJzZWxlY3RlZFwiKSkge1xuICAgICAgICAgICAgbGV0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgICAgIHNwYW4uY2xhc3NOYW1lID0gXCJ0YXJzaWVyLWhpZ2hsaWdodGVkLXdvcmRcIjtcbiAgICAgICAgICAgIHNwYW4udGV4dENvbnRlbnQgPSB0ZXh0Q29udGVudDtcbiAgICAgICAgICAgIGlmIChub2RlLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgICAgbm9kZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChzcGFuLCBub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHBhcnRzID0gdGV4dENvbnRlbnQuc3BsaXQodGFyc2llclRhZ1JlZ2V4KTtcbiAgICAgICAgICAgIGxldCBtYXRjaGVzID0gdGV4dENvbnRlbnQubWF0Y2godGFyc2llclRhZ1JlZ2V4KTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcblxuICAgICAgICAgICAgcGFydHMuZm9yRWFjaCgocGFydCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgbGV0IHRva2VucyA9IHBhcnQuc3BsaXQoLyhcXHMrKS9nKTtcbiAgICAgICAgICAgICAgdG9rZW5zLmZvckVhY2goKHRva2VuKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgICAgICAgICBpZiAodG9rZW4udHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgc3Bhbi5jbGFzc05hbWUgPSBcInRhcnNpZXItc3BhY2VcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc3Bhbi5jbGFzc05hbWUgPSBcInRhcnNpZXItaGlnaGxpZ2h0ZWQtd29yZFwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcGFuLnRleHRDb250ZW50ID0gdG9rZW47XG4gICAgICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoc3Bhbik7XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGlmIChtYXRjaGVzICYmIG1hdGNoZXNbaW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgICAgICAgICBzcGFuLmNsYXNzTmFtZSA9IFwidGFyc2llci1oaWdobGlnaHRlZC13b3JkXCI7XG4gICAgICAgICAgICAgICAgc3Bhbi50ZXh0Q29udGVudCA9IG1hdGNoZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHNwYW4pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKGZyYWdtZW50LmNoaWxkTm9kZXMubGVuZ3RoID4gMCAmJiBub2RlLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgICAgZWxlbWVudC5pbnNlcnRCZWZvcmUoZnJhZ21lbnQsIG5vZGUpO1xuICAgICAgICAgICAgICBub2RlLnJlbW92ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBhcHBseUhpZ2hsaWdodGluZyhkb2N1bWVudCk7XG5cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcImlmcmFtZVwiKS5mb3JFYWNoKChpZnJhbWUpID0+IHtcbiAgICB0cnkge1xuICAgICAgaWZyYW1lLmNvbnRlbnRXaW5kb3c/LnBvc3RNZXNzYWdlKHsgYWN0aW9uOiBcImhpZ2hsaWdodFwiIH0sIFwiKlwiKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGFjY2Vzc2luZyBpZnJhbWUgY29udGVudDogXCIsIGVycm9yKTtcbiAgICB9XG4gIH0pO1xufTtcblxud2luZG93LmRvY3VtZW50RGltZW5zaW9ucyA9ICgpID0+IHtcbiAgcmV0dXJuIHtcbiAgICB3aWR0aDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFdpZHRoLFxuICAgIGhlaWdodDogZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbEhlaWdodCxcbiAgfTtcbn07XG5cbndpbmRvdy5nZXRFbGVtZW50Qm91bmRpbmdCb3hlcyA9ICh4cGF0aDogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICB4cGF0aCxcbiAgICBkb2N1bWVudCxcbiAgICBudWxsLFxuICAgIFhQYXRoUmVzdWx0LkZJUlNUX09SREVSRURfTk9ERV9UWVBFLFxuICAgIG51bGwsXG4gICkuc2luZ2xlTm9kZVZhbHVlIGFzIEhUTUxFbGVtZW50O1xuICBpZiAoZWxlbWVudCkge1xuICAgIGNvbnN0IGlzVmFsaWRUZXh0ID0gKHRleHQ6IHN0cmluZykgPT4gdGV4dCAmJiB0ZXh0LnRyaW0oKS5sZW5ndGggPiAwO1xuICAgIGxldCBkcm9wRG93bkVsZW0gPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJvcHRpb25bc2VsZWN0ZWRdXCIpO1xuXG4gICAgaWYgKCFkcm9wRG93bkVsZW0pIHtcbiAgICAgIGRyb3BEb3duRWxlbSA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIm9wdGlvblwiKTtcbiAgICB9XG5cbiAgICBpZiAoZHJvcERvd25FbGVtKSB7XG4gICAgICBjb25zdCBlbGVtVGV4dCA9IGRyb3BEb3duRWxlbS50ZXh0Q29udGVudCB8fCBcIlwiO1xuICAgICAgaWYgKGlzVmFsaWRUZXh0KGVsZW1UZXh0KSkge1xuICAgICAgICBjb25zdCBwYXJlbnRSZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0ZXh0OiBlbGVtVGV4dC50cmltKCksXG4gICAgICAgICAgICB0b3A6IHBhcmVudFJlY3QudG9wICsgd2luZG93LnNjcm9sbFksXG4gICAgICAgICAgICBsZWZ0OiBwYXJlbnRSZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWCxcbiAgICAgICAgICAgIHdpZHRoOiBwYXJlbnRSZWN0LndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBwYXJlbnRSZWN0LmhlaWdodCxcbiAgICAgICAgICB9LFxuICAgICAgICBdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgcGxhY2Vob2xkZXJUZXh0ID0gXCIgXCI7XG4gICAgaWYgKFxuICAgICAgKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImlucHV0XCIgfHxcbiAgICAgICAgZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwidGV4dGFyZWFcIikgJiZcbiAgICAgIChlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQpLnBsYWNlaG9sZGVyXG4gICAgKSB7XG4gICAgICBwbGFjZWhvbGRlclRleHQgPSAoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50KS5wbGFjZWhvbGRlcjtcbiAgICB9IGVsc2UgaWYgKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImFcIikge1xuICAgICAgcGxhY2Vob2xkZXJUZXh0ID0gXCIgXCI7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJpbWdcIikge1xuICAgICAgcGxhY2Vob2xkZXJUZXh0ID0gKGVsZW1lbnQgYXMgSFRNTEltYWdlRWxlbWVudCkuYWx0IHx8IFwiIFwiO1xuICAgIH1cblxuICAgIGNvbnN0IHdvcmRzID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFxuICAgICAgXCI6c2NvcGUgPiAudGFyc2llci1oaWdobGlnaHRlZC13b3JkXCIsXG4gICAgKSBhcyBOb2RlTGlzdE9mPEhUTUxFbGVtZW50PjtcbiAgICBjb25zdCBib3VuZGluZ0JveGVzID0gQXJyYXkuZnJvbSh3b3JkcylcbiAgICAgIC5tYXAoKHdvcmQpID0+IHtcbiAgICAgICAgY29uc3QgcmVjdCA9ICh3b3JkIGFzIEhUTUxFbGVtZW50KS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0ZXh0OiB3b3JkLmlubmVyVGV4dCB8fCBcIlwiLFxuICAgICAgICAgIHRvcDogcmVjdC50b3AgKyB3aW5kb3cuc2Nyb2xsWSxcbiAgICAgICAgICBsZWZ0OiByZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWCxcbiAgICAgICAgICB3aWR0aDogcmVjdC53aWR0aCxcbiAgICAgICAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0ICogMC43NSxcbiAgICAgICAgfTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKFxuICAgICAgICAoYm94KSA9PlxuICAgICAgICAgIGJveC53aWR0aCA+IDAgJiZcbiAgICAgICAgICBib3guaGVpZ2h0ID4gMCAmJlxuICAgICAgICAgIGJveC50b3AgPj0gMCAmJlxuICAgICAgICAgIGJveC5sZWZ0ID49IDAgJiZcbiAgICAgICAgICBpc1ZhbGlkVGV4dChib3gudGV4dCksXG4gICAgICApO1xuXG4gICAgaWYgKHdvcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc3QgZWxlbWVudFJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgIHRleHQ6IHBsYWNlaG9sZGVyVGV4dCxcbiAgICAgICAgICB0b3A6IGVsZW1lbnRSZWN0LnRvcCArIHdpbmRvdy5zY3JvbGxZLFxuICAgICAgICAgIGxlZnQ6IGVsZW1lbnRSZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWCxcbiAgICAgICAgICB3aWR0aDogZWxlbWVudFJlY3Qud2lkdGgsXG4gICAgICAgICAgaGVpZ2h0OiBlbGVtZW50UmVjdC5oZWlnaHQgKiAwLjc1LFxuICAgICAgICB9LFxuICAgICAgXTtcbiAgICB9XG5cbiAgICByZXR1cm4gYm91bmRpbmdCb3hlcztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGdldEZpeGVkUG9zaXRpb24oZWxlbWVudDogSFRNTEVsZW1lbnQpOiB7XG4gIGlzRml4ZWQ6IGJvb2xlYW47XG4gIGZpeGVkUG9zaXRpb246IHN0cmluZztcbn0ge1xuICBsZXQgaXNGaXhlZCA9IGZhbHNlO1xuICBsZXQgZml4ZWRQb3NpdGlvbiA9IFwibm9uZVwiO1xuICBsZXQgY3VycmVudEVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCA9IGVsZW1lbnQ7XG5cbiAgd2hpbGUgKGN1cnJlbnRFbGVtZW50KSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShjdXJyZW50RWxlbWVudCk7XG4gICAgaWYgKHN0eWxlLnBvc2l0aW9uID09PSBcImZpeGVkXCIpIHtcbiAgICAgIGlzRml4ZWQgPSB0cnVlO1xuICAgICAgY29uc3QgcmVjdCA9IGN1cnJlbnRFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgaWYgKHJlY3QudG9wID09PSAwKSB7XG4gICAgICAgIGZpeGVkUG9zaXRpb24gPSBcInRvcFwiO1xuICAgICAgfSBlbHNlIGlmIChyZWN0LmJvdHRvbSA9PT0gd2luZG93LmlubmVySGVpZ2h0KSB7XG4gICAgICAgIGZpeGVkUG9zaXRpb24gPSBcImJvdHRvbVwiO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGN1cnJlbnRFbGVtZW50ID0gY3VycmVudEVsZW1lbnQucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIHJldHVybiB7IGlzRml4ZWQsIGZpeGVkUG9zaXRpb24gfTtcbn1cblxud2luZG93LmNoZWNrSGFzVGFnZ2VkQ2hpbGRyZW4gPSAoeHBhdGg6IHN0cmluZyk6IGJvb2xlYW4gPT4ge1xuICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgeHBhdGgsXG4gICAgZG9jdW1lbnQsXG4gICAgbnVsbCxcbiAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICBudWxsLFxuICApLnNpbmdsZU5vZGVWYWx1ZSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChlbGVtZW50KSB7XG4gICAgY29uc3QgdGFnZ2VkQ2hpbGRyZW4gPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWNvbG9yZWQ9XCJ0cnVlXCJdJyk7XG4gICAgcmV0dXJuICEhdGFnZ2VkQ2hpbGRyZW47XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxud2luZG93LnNldEVsZW1lbnRWaXNpYmlsaXR5VG9IaWRkZW4gPSAoeHBhdGg6IHN0cmluZykgPT4ge1xuICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgeHBhdGgsXG4gICAgZG9jdW1lbnQsXG4gICAgbnVsbCxcbiAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICBudWxsLFxuICApLnNpbmdsZU5vZGVWYWx1ZSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gIGlmIChlbGVtZW50KSB7XG4gICAgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIjtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYFRyaWVkIHRvIGhpZGUgZWxlbWVudC4gRWxlbWVudCBub3QgZm91bmQgZm9yIFhQYXRoOiAke3hwYXRofWAsXG4gICAgKTtcbiAgfVxufTtcblxud2luZG93LnJlQ29sb3VyRWxlbWVudHMgPSAoY29sb3VyZWRFbGVtczogQ29sb3VyZWRFbGVtW10pOiBDb2xvdXJlZEVsZW1bXSA9PiB7XG4gIGNvbnN0IHRvdGFsVGFncyA9IGNvbG91cmVkRWxlbXMubGVuZ3RoO1xuICBjb25zdCBjb2xvcnMgPSBnZXROZXh0Q29sb3JzKHRvdGFsVGFncyk7XG5cbiAgY29uc3QgZWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBjb2xvdXJlZEVsZW1zLm1hcCgoZWxlbSkgPT4ge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5ldmFsdWF0ZShcbiAgICAgIGVsZW0ueHBhdGgsXG4gICAgICBkb2N1bWVudCxcbiAgICAgIG51bGwsXG4gICAgICBYUGF0aFJlc3VsdC5GSVJTVF9PUkRFUkVEX05PREVfVFlQRSxcbiAgICAgIG51bGwsXG4gICAgKS5zaW5nbGVOb2RlVmFsdWUgYXMgSFRNTEVsZW1lbnQ7XG4gICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkXCIsIGVsZW0uaWQudG9TdHJpbmcoKSk7XG4gICAgcmV0dXJuIGVsZW1lbnQ7XG4gIH0pO1xuXG4gIGNvbnN0IGNvbG9yQXNzaWdubWVudHMgPSBhc3NpZ25Db2xvcnMoZWxlbWVudHMsIGNvbG9ycyk7XG5cbiAgY29uc3QgYm9keVJlY3QgPSBkb2N1bWVudC5ib2R5LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gIGNvbnN0IHVwZGF0ZWRDb2xvdXJlZEVsZW1zID0gY29sb3VyZWRFbGVtcy5tYXAoKGVsZW0pID0+IHtcbiAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuZXZhbHVhdGUoXG4gICAgICBlbGVtLnhwYXRoLFxuICAgICAgZG9jdW1lbnQsXG4gICAgICBudWxsLFxuICAgICAgWFBhdGhSZXN1bHQuRklSU1RfT1JERVJFRF9OT0RFX1RZUEUsXG4gICAgICBudWxsLFxuICAgICkuc2luZ2xlTm9kZVZhbHVlIGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IGNvbG9yID0gY29sb3JBc3NpZ25tZW50cy5nZXQoZWxlbWVudCkhO1xuICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIGNvbnN0IG1pZHBvaW50OiBbbnVtYmVyLCBudW1iZXJdID0gW3JlY3QubGVmdCwgcmVjdC50b3BdO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRNaWRwb2ludDogW251bWJlciwgbnVtYmVyXSA9IFtcbiAgICAgIChtaWRwb2ludFswXSAtIGJvZHlSZWN0LmxlZnQpIC8gYm9keVJlY3Qud2lkdGgsXG4gICAgICAobWlkcG9pbnRbMV0gLSBib2R5UmVjdC50b3ApIC8gYm9keVJlY3QuaGVpZ2h0LFxuICAgIF07XG5cbiAgICBlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiYmFja2dyb3VuZC1jb2xvclwiLCBjb2xvciwgXCJpbXBvcnRhbnRcIik7XG4gICAgZWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eShcImNvbG9yXCIsIGNvbG9yLCBcImltcG9ydGFudFwiKTtcbiAgICBlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwiYm9yZGVyLWNvbG9yXCIsIGNvbG9yLCBcImltcG9ydGFudFwiKTtcbiAgICBlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KFwib3BhY2l0eVwiLCBcIjFcIiwgXCJpbXBvcnRhbnRcIik7XG4gICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWNvbG9yZWRcIiwgXCJ0cnVlXCIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmVsZW0sXG4gICAgICBjb2xvcixcbiAgICAgIG1pZHBvaW50LFxuICAgICAgbm9ybWFsaXplZE1pZHBvaW50LFxuICAgICAgd2lkdGg6IHJlY3Qud2lkdGgsXG4gICAgICBoZWlnaHQ6IHJlY3QuaGVpZ2h0LFxuICAgICAgYm91bmRpbmdCb3hYOiByZWN0LngsXG4gICAgICBib3VuZGluZ0JveFk6IHJlY3QueSxcbiAgICB9O1xuICB9KTtcblxuICByZXR1cm4gdXBkYXRlZENvbG91cmVkRWxlbXM7XG59O1xuXG53aW5kb3cuZGlzYWJsZVRyYW5zaXRpb25zQW5kQW5pbWF0aW9ucyA9ICgpID0+IHtcbiAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XG4gIHN0eWxlLmlubmVySFRNTCA9IGBcbiAgICAqLCAqOjpiZWZvcmUsICo6OmFmdGVyIHtcbiAgICAgIHRyYW5zaXRpb24tcHJvcGVydHk6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIHRyYW5zaXRpb24tZHVyYXRpb246IDBzICFpbXBvcnRhbnQ7XG4gICAgICB0cmFuc2l0aW9uLXRpbWluZy1mdW5jdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgdHJhbnNpdGlvbi1kZWxheTogMHMgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgYW5pbWF0aW9uLW5hbWU6IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbi1kdXJhdGlvbjogMHMgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbi10aW1pbmctZnVuY3Rpb246IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbi1kZWxheTogMHMgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbi1pdGVyYXRpb24tY291bnQ6IDEgIWltcG9ydGFudDtcbiAgICAgIGFuaW1hdGlvbi1kaXJlY3Rpb246IG5vcm1hbCAhaW1wb3J0YW50O1xuICAgICAgYW5pbWF0aW9uLWZpbGwtbW9kZTogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgYW5pbWF0aW9uLXBsYXktc3RhdGU6IHBhdXNlZCAhaW1wb3J0YW50O1xuICAgIH1cbiAgYDtcbiAgc3R5bGUuaWQgPSBcImRpc2FibGUtdHJhbnNpdGlvbnNcIjtcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7XG59O1xuXG53aW5kb3cuZW5hYmxlVHJhbnNpdGlvbnNBbmRBbmltYXRpb25zID0gKCkgPT4ge1xuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGlzYWJsZS10cmFuc2l0aW9uc1wiKTtcbiAgaWYgKHN0eWxlKSB7XG4gICAgc3R5bGUucmVtb3ZlKCk7XG4gIH1cbn07XG5cbi8vIExFQVZFIEFTIExBU1QgTElORS4gRE8gTk9UIFJFTU9WRVxuLy8gSmF2YVNjcmlwdCBzY3JpcHRzLCB3aGVuIHJ1biBpbiB0aGUgSmF2YVNjcmlwdCBjb25zb2xlLCB3aWxsIGV2YWx1YXRlIHRvIHRoZSBsYXN0IGxpbmUvZXhwcmVzc2lvbiBpbiB0aGUgc2NyaXB0XG4vLyBUaGlzIHRhZyB1dGlscyBmaWxlIHdpbGwgdHlwaWNhbGx5IGVuZCBpbiBhIGZ1bmN0aW9uIGFzc2lnbm1lbnRcbi8vIEZ1bmN0aW9uIGFzc2lnbm1lbnRzIHdpbGwgZXZhbHVhdGUgdG8gdGhlIGNyZWF0ZWQgZnVuY3Rpb25cbi8vIElmIHBsYXl3cmlnaHQgLmV2YWx1YXRlKEpTX0NPREUpIGV2YWx1YXRlcyB0byBhIGZ1bmN0aW9uLCBJVCBXSUxMIENBTEwgVEhFIEZVTkNUSU9OXG4vLyBUaGlzIG1lYW5zIHRoYXQgdGhlIGxhc3QgZnVuY3Rpb24gaW4gdGhpcyBmaWxlIHdpbGwgcmFuZG9tbHkgZ2V0IGNhbGxlZCB3aGVuZXZlciB3ZSBsb2FkIGluIHRoZSBKUyxcbi8vIHVubGVzcyB3ZSBoYXZlIHNvbWV0aGluZyBsaWtlIHRoaXMgY29uc29sZS5sb2cgKFdoaWNoIHJldHVybnMgdW5kZWZpbmVkKSBpcyBwbGFjZWQgYXQgdGhlIGVuZFxuXG5jb25zb2xlLmxvZyhcIlRhcnNpZXIgdGFnIHV0aWxzIGxvYWRlZFwiKTtcbiJdfQ==
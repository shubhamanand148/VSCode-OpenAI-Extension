var app = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    new Set();
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* webviews\components\OpenAI.svelte generated by Svelte v3.58.0 */

    function create_fragment(ctx) {
    	let div3;
    	let label;
    	let t1;
    	let div0;
    	let select;
    	let optgroup0;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let optgroup1;
    	let option4;
    	let option5;
    	let option6;
    	let option7;
    	let option8;
    	let optgroup2;
    	let option9;
    	let option10;
    	let option11;
    	let option12;
    	let option13;
    	let option14;
    	let option15;
    	let t18;
    	let br0;
    	let t19;
    	let div1;
    	let p0;
    	let t20;
    	let t21;
    	let t22;
    	let input;
    	let t23;
    	let br1;
    	let t24;
    	let div2;
    	let t26;
    	let textarea;
    	let t27;
    	let button0;
    	let t29;
    	let button1;
    	let t31;
    	let br2;
    	let t32;
    	let div4;
    	let h3;
    	let t34;
    	let p2;
    	let t35;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div3 = element("div");
    			label = element("label");
    			label.textContent = "Model:";
    			t1 = space();
    			div0 = element("div");
    			select = element("select");
    			optgroup0 = element("optgroup");
    			option0 = element("option");
    			option0.textContent = "gpt-4";
    			option1 = element("option");
    			option1.textContent = "gpt-4-0314";
    			option2 = element("option");
    			option2.textContent = "gpt-4-32k";
    			option3 = element("option");
    			option3.textContent = "gpt-4-32k-0314";
    			optgroup1 = element("optgroup");
    			option4 = element("option");
    			option4.textContent = "gpt-3.5-turbo";
    			option5 = element("option");
    			option5.textContent = "gpt-3.5-turbo-0301";
    			option6 = element("option");
    			option6.textContent = "text-davinci-003";
    			option7 = element("option");
    			option7.textContent = "text-davinci-002";
    			option8 = element("option");
    			option8.textContent = "code-davinci-002";
    			optgroup2 = element("optgroup");
    			option9 = element("option");
    			option9.textContent = "text-curie-001";
    			option10 = element("option");
    			option10.textContent = "text-babbage-001";
    			option11 = element("option");
    			option11.textContent = "text-ada-001";
    			option12 = element("option");
    			option12.textContent = "davinci";
    			option13 = element("option");
    			option13.textContent = "curie";
    			option14 = element("option");
    			option14.textContent = "babbage";
    			option15 = element("option");
    			option15.textContent = "ada";
    			t18 = space();
    			br0 = element("br");
    			t19 = space();
    			div1 = element("div");
    			p0 = element("p");
    			t20 = text("Temperature: ");
    			t21 = text(/*temperature*/ ctx[3]);
    			t22 = space();
    			input = element("input");
    			t23 = space();
    			br1 = element("br");
    			t24 = space();
    			div2 = element("div");
    			div2.innerHTML = `<p>Input Prompt:</p>`;
    			t26 = space();
    			textarea = element("textarea");
    			t27 = space();
    			button0 = element("button");
    			button0.textContent = "Send";
    			t29 = space();
    			button1 = element("button");
    			button1.textContent = "Clear";
    			t31 = space();
    			br2 = element("br");
    			t32 = space();
    			div4 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Response:";
    			t34 = space();
    			p2 = element("p");
    			t35 = text(/*outputPrompt*/ ctx[1]);
    			attr(label, "for", "model");
    			option0.__value = "gpt-4";
    			option0.value = option0.__value;
    			option1.__value = "gpt-4-0314";
    			option1.value = option1.__value;
    			option2.__value = "gpt-4-32k";
    			option2.value = option2.__value;
    			option3.__value = "gpt-4-32k-0314";
    			option3.value = option3.__value;
    			attr(optgroup0, "label", "GPT-4");
    			option4.__value = "gpt-3.5-turbo";
    			option4.value = option4.__value;
    			option5.__value = "gpt-3.5-turbo-0301";
    			option5.value = option5.__value;
    			option6.__value = "text-davinci-003";
    			option6.value = option6.__value;
    			option7.__value = "text-davinci-002";
    			option7.value = option7.__value;
    			option8.__value = "code-davinci-002";
    			option8.value = option8.__value;
    			attr(optgroup1, "label", "GPT-3.5");
    			option9.__value = "text-curie-001";
    			option9.value = option9.__value;
    			option10.__value = "text-babbage-001";
    			option10.value = option10.__value;
    			option11.__value = "text-ada-001";
    			option11.value = option11.__value;
    			option12.__value = "davinci";
    			option12.value = option12.__value;
    			option13.__value = "curie";
    			option13.value = option13.__value;
    			option14.__value = "babbage";
    			option14.value = option14.__value;
    			option15.__value = "ada";
    			option15.value = option15.__value;
    			attr(optgroup2, "label", "GPT-3");
    			attr(select, "name", "model");
    			if (/*selectedModel*/ ctx[2] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[4].call(select));
    			attr(input, "type", "range");
    			attr(input, "min", "0");
    			attr(input, "max", "1");
    			attr(input, "step", "0.01");
    			attr(button0, "type", "submit");
    			attr(button1, "type", "reset");
    		},
    		m(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, label);
    			append(div3, t1);
    			append(div3, div0);
    			append(div0, select);
    			append(select, optgroup0);
    			append(optgroup0, option0);
    			append(optgroup0, option1);
    			append(optgroup0, option2);
    			append(optgroup0, option3);
    			append(select, optgroup1);
    			append(optgroup1, option4);
    			append(optgroup1, option5);
    			append(optgroup1, option6);
    			append(optgroup1, option7);
    			append(optgroup1, option8);
    			append(select, optgroup2);
    			append(optgroup2, option9);
    			append(optgroup2, option10);
    			append(optgroup2, option11);
    			append(optgroup2, option12);
    			append(optgroup2, option13);
    			append(optgroup2, option14);
    			append(optgroup2, option15);
    			select_option(select, /*selectedModel*/ ctx[2], true);
    			append(div3, t18);
    			append(div3, br0);
    			append(div3, t19);
    			append(div3, div1);
    			append(div1, p0);
    			append(p0, t20);
    			append(p0, t21);
    			append(div1, t22);
    			append(div1, input);
    			set_input_value(input, /*temperature*/ ctx[3]);
    			append(div3, t23);
    			append(div3, br1);
    			append(div3, t24);
    			append(div3, div2);
    			append(div3, t26);
    			append(div3, textarea);
    			set_input_value(textarea, /*inputPrompt*/ ctx[0]);
    			append(div3, t27);
    			append(div3, button0);
    			append(div3, t29);
    			append(div3, button1);
    			insert(target, t31, anchor);
    			insert(target, br2, anchor);
    			insert(target, t32, anchor);
    			insert(target, div4, anchor);
    			append(div4, h3);
    			append(div4, t34);
    			append(div4, p2);
    			append(p2, t35);

    			if (!mounted) {
    				dispose = [
    					listen(select, "change", /*select_change_handler*/ ctx[4]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[5]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[5]),
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[6]),
    					listen(button0, "click", /*click_handler*/ ctx[7]),
    					listen(button1, "click", /*click_handler_1*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*selectedModel*/ 4) {
    				select_option(select, /*selectedModel*/ ctx[2]);
    			}

    			if (dirty & /*temperature*/ 8) set_data(t21, /*temperature*/ ctx[3]);

    			if (dirty & /*temperature*/ 8) {
    				set_input_value(input, /*temperature*/ ctx[3]);
    			}

    			if (dirty & /*inputPrompt*/ 1) {
    				set_input_value(textarea, /*inputPrompt*/ ctx[0]);
    			}

    			if (dirty & /*outputPrompt*/ 2) set_data(t35, /*outputPrompt*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div3);
    			if (detaching) detach(t31);
    			if (detaching) detach(br2);
    			if (detaching) detach(t32);
    			if (detaching) detach(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let inputPrompt;
    	let outputPrompt = "Yor Code will be shown here";
    	let selectedModel;
    	let temperature = 0;

    	onMount(() => {
    		window.addEventListener('message', event => {
    			const message = event.data; // The json data that the extension sent
    			console.log("This is message in svelte");
    			console.log({ message });

    			switch (message.type) {
    				case 'openai-response':
    					$$invalidate(1, outputPrompt = message.value);
    					break;
    			}
    		});
    	});

    	function select_change_handler() {
    		selectedModel = select_value(this);
    		$$invalidate(2, selectedModel);
    	}

    	function input_change_input_handler() {
    		temperature = to_number(this.value);
    		$$invalidate(3, temperature);
    	}

    	function textarea_input_handler() {
    		inputPrompt = this.value;
    		$$invalidate(0, inputPrompt);
    	}

    	const click_handler = () => {
    		vscodeApi.postMessage({
    			type: 'inputPrompt',
    			value: { inputPrompt, selectedModel, temperature }
    		});
    	};

    	const click_handler_1 = () => {
    		$$invalidate(0, inputPrompt = "");
    	};

    	return [
    		inputPrompt,
    		outputPrompt,
    		selectedModel,
    		temperature,
    		select_change_handler,
    		input_change_input_handler,
    		textarea_input_handler,
    		click_handler,
    		click_handler_1
    	];
    }

    class OpenAI extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new OpenAI({
        target: document.body
    });

    return app;

})();
//# sourceMappingURL=sidebar.js.map

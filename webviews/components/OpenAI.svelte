<script lang="ts">
    import { onMount } from "svelte";

    let inputPrompt:string;
    let outputPrompt = "Yor Code will be shown here";
    let selectedModel:string;
    let temperature = 0;

    onMount(() => {
        window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        console.log("This is message in svelte")
        console.log({message});
        switch (message.type) {
            case 'openai-response':
                outputPrompt = message.value
                break;
            }
        });
    })
</script>

<style>

</style>

<div>
    <label for="model">Model: </label>
    <div>
        <select name="model" bind:value={selectedModel}>
            <optgroup label="GPT-4">
                <option value="gpt-4">gpt-4</option>
                <option value="gpt-4-0314">gpt-4-0314</option>
                <option value="gpt-4-32k">gpt-4-32k</option>
                <option value="gpt-4-32k-0314">gpt-4-32k-0314</option>
            </optgroup>

            <optgroup label="GPT-3.5">
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                <option value="gpt-3.5-turbo-0301">gpt-3.5-turbo-0301</option>
                <option value="text-davinci-003">text-davinci-003</option>
                <option value="text-davinci-002">text-davinci-002</option>
                <option value="code-davinci-002">code-davinci-002</option>
                </optgroup>

                <optgroup label="GPT-3">
                <option value="text-curie-001">text-curie-001</option>
                <option value="text-babbage-001">text-babbage-001</option>
                <option value="text-ada-001">text-ada-001</option>
                <option value="davinci">davinci</option>
                <option value="curie">curie</option>
                <option value="babbage">babbage</option>
                <option value="ada">ada</option>
                </optgroup>
        </select>
    </div>
    <br />
    <div>
        <p>Temperature: {temperature}</p>
        <input type="range" min="0" max="1" step="0.01" bind:value={temperature} />
    </div>
    
    <br />
    
    <div>
        <p>Input Prompt: </p>
    </div>

    <textarea bind:value={ inputPrompt }/>
    <button type="submit" on:click={() =>{
        vscodeApi.postMessage({
        type: 'inputPrompt',
        value: { inputPrompt: inputPrompt, selectedModel: selectedModel, temperature: temperature}
    });
    }}>Send</button>

    <button type="reset" on:click={() => {
        inputPrompt = "";
    }}>Clear</button>
</div>
<br />
<div>
    <h3>Response: </h3>
    <p>{outputPrompt}</p>
</div>

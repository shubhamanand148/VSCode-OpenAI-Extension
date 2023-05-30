// import * as dotenv from "dotenv";
const { Configuration, OpenAIApi } = require("openai");

// dotenv.config();

const OPENAI_API_KEY="Enter the API_KEY from OpenAI API";
const configuration = new Configuration({apiKey: OPENAI_API_KEY});
const openai = new OpenAIApi(configuration);

async function openAIResponse(prompt: string, model: string, temperature: number): Promise<any>{
    try{

        // const prompt = "Write a program in python to enter 3 numbers from the user and print the sum of the numbers.";
        // const model = "text-davinci-003";

        const response = await openai.createCompletion({
            model: model,
            prompt: prompt,
            temperature: temperature,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0.5,
            presence_penalty: 0
        });

        const code = response.data.choices[0].text;
        return code;

    } catch (error){
        console.log(error);
        return error;
    }
}

export {openAIResponse};
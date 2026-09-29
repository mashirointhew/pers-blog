import { getCollection } from 'astro:content';
export async function getPosts(){return (await getCollection('posts',({data})=>!data.draft)).sort((a,b)=>b.data.date.valueOf()-a.data.date.valueOf())}
export function formatDate(date:Date){return new Intl.DateTimeFormat('en',{dateStyle:'long'}).format(date)}
export function postSlug(id:string){return id.replace(/\.(md|mdx)$/,'')}
export function readingTime(body:string){return Math.max(1,Math.ceil(body.trim().split(/\s+/).length/200))}
export async function getTagMap(){const posts=await getPosts();return posts.reduce<Record<string,typeof posts>>((map,post)=>{post.data.tags.forEach(tag=>(map[tag]??=[]).push(post));return map}, {})}

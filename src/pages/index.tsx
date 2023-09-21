import Head from "next/head"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Avatar } from "@radix-ui/react-avatar"
import randomColor from "randomcolor"
import ReactMarkdown from "react-markdown"

const ChatBar = ({ storyId }: { storyId: string }) => {
  const [chatId, setChatId] = useState(null)
  const [userInput, setUserInput] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [latestState, setLatestState] = useState(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (latestState === "COMPLETE" && message !== "") {
      setUserInput(message)
      setMessage("")
    }
  }, [latestState, message])

  const streamReply = useCallback(
    async (input: string) => {
      setIsLoading(true)
      setMessage("")

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_HOST}/refine`,
        {
          method: "POST",
          body: JSON.stringify({
            story_id: storyId,
            user_input: input,
            chat_id: chatId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      const reader = response.body?.getReader()

      let { value, done } = await reader?.read()!
      while (!done) {
        const parsedChunks = new TextDecoder("utf-8")
          .decode(value)
          .split("}")
          .slice(0, -1)
          .map((chunk) => chunk + "}")

        parsedChunks.forEach((parsedChunk) => {
          const dataChunk = JSON.parse(parsedChunk)
          setLatestState(dataChunk.state)
          setChatId(dataChunk.chat_id)
          setMessage((prev) => prev + dataChunk.delta)
        })

        const nextChunk = await reader?.read()!

        value = nextChunk.value
        done = nextChunk.done
      }

      inputRef.current?.select()
      setIsLoading(false)
    },
    [chatId, storyId]
  )

  return (
    <div className="flex-1">
      <div style={{ position: "relative" }}>
        {message || isLoading ? (
          <div className="absolute bottom-0 bg-indigo-500 text-white p-4 rounded-lg bg-card text-card-foreground shadow-2xl text-sm font-mono shadow-indigo-500/50">
            {message}
            {isLoading ? "..." : null}
          </div>
        ) : null}
      </div>
      <form
        className="flex gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          streamReply(userInput)
        }}
      >
        <Input
          ref={inputRef}
          className="flex-1"
          type="text"
          onChange={(e) => setUserInput(e.target.value)}
          value={userInput}
          placeholder="Leave a comment"
        />
        <Button type="submit">
          {isLoading
            ? "Loading..."
            : latestState === "COMPLETE"
            ? "Post"
            : "Refine"}
        </Button>
      </form>
    </div>
  )
}

type Story = {
  id: string
  title: string
  summary: string
  comments?: { id: string; text: string }[]
}

const StoryCard = ({ story }: { story: Story }) => {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-lg">{story.title}</h2>
      </CardHeader>
      <CardContent>
        <ReactMarkdown>{story.summary}</ReactMarkdown>
        <div className="mt-3">
          {story.comments?.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-2 mb-2 text-gray-700"
            >
              <div
                style={{
                  marginTop: 2,
                  backgroundColor: randomColor({ seed: comment.text }),
                  width: 20,
                  height: 20,
                  borderRadius: 1000,
                  flexShrink: 0,
                }}
              />
              <div className="text-sm gray-100">{comment.text}</div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <ChatBar storyId={story.id} />
      </CardFooter>
    </Card>
  )
}

export default function Home() {
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_HOST}/news/stories`)
      .then((res) => res.json())
      .then((data) => {
        setStories(data)
      })
  }, [])

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="py-8 px-4 max-w-2xl mx-auto">
        <header className="my-8 ">
          <h1 className="text-2xl font-bold">Comment Copilot</h1>
        </header>
        <main className="flex flex-col items-center justify-between gap-4">
          {stories.map((story) => (
            <StoryCard story={story} key={story.id} />
          ))}
        </main>
      </div>
    </>
  )
}

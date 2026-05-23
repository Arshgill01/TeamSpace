
export function App({ subreddit, username }: { subreddit: string; username: string }) {
  return (
    <div>
      <h1>TeamSpace Dashboard: r/{subreddit}</h1>
      <p>Logged in as u/{username}</p>
    </div>
  );
}
export default App;

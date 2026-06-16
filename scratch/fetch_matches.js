const url = "https://zvwvyfmaklesgjnfdfyu.supabase.co/rest/v1/matches?select=scoreline,is_home,result&result=neq.Pending";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3Z5Zm1ha2xlc2dqbmZkZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzIzNjcsImV4cCI6MjA4NTYwODM2N30.MIHWWEtV5vSMJcGqysPJqtsZdsBKpqt9rzRnpV2BVLQ";
fetch(url, { headers: { "apikey": key, "Authorization": "Bearer " + key } })
  .then(r => r.json())
  .then(console.log);

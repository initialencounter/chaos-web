import type { PostCommentListResponse, PostGetResponse, PostList, PostListGoodUserResponse, PostListReplyResponse } from '@tapsss/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { forumApi } from '@/api'

export const usePostStore = defineStore('post', () => {
  const postList = ref<PostList | null>(null)
  const currentPost = ref<PostGetResponse | null>(null)
  const currentComments = ref<PostCommentListResponse | null>(null)
  const searchResults = ref<PostList | null>(null)
  const goodUsers = ref<PostListGoodUserResponse | null>(null)
  const commentReplies = ref<PostListReplyResponse | null>(null)
  const isLoading = ref(false)

  async function fetchPostList(type = 0, page = 0, count = 20) {
    isLoading.value = true
    try {
      postList.value = await forumApi.fetchPostList(type, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchPost(postId: number) {
    isLoading.value = true
    try {
      currentPost.value = await forumApi.postGet(postId)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchComments(postId: number, sort = 0, page = 0, count = 20) {
    isLoading.value = true
    try {
      currentComments.value = await forumApi.commentList(postId, sort, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function searchPosts(keyword: string, page = 0, count = 20) {
    isLoading.value = true
    try {
      searchResults.value = await forumApi.postListSearch(keyword, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchGoodUsers(postId: number, page = 0, count = 20) {
    isLoading.value = true
    try {
      goodUsers.value = await forumApi.postListGoodUser(postId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  async function fetchCommentReplies(commentId: number, page = 0, count = 20) {
    isLoading.value = true
    try {
      commentReplies.value = await forumApi.commentReplyList(commentId, page, count)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    postList,
    currentPost,
    currentComments,
    searchResults,
    goodUsers,
    commentReplies,
    isLoading,
    fetchPostList,
    fetchPost,
    fetchComments,
    searchPosts,
    fetchGoodUsers,
    fetchCommentReplies,
  }
})

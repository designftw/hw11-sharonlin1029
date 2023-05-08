import * as Vue from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from 'https://graffiti.garden/graffiti-js/plugins/vue/plugin.js'
import Resolver from './resolver.js'

const app = {
  // Import MaVue
  mixins: [mixin],

  // Import resolver
  async created() {
    this.resolver = new Resolver(this.$gf);
    this.$gf.events.addEventListener("connected", async () => {
      this.myUsername = await this.resolver.actorToUsername(this.$gf.me);
    });
  },

  setup() {
    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref('sharon')

    // And a flag for whether or not we're private-messaging
    const privateMessaging = Vue.ref(false)

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject('graffiti')
    const context = Vue.computed(() => privateMessaging.value ? [$gf.me] : [channel.value])

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context);
    return { channel, privateMessaging, messagesRaw }
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: '',
      editID: '',
      editText: '',
      recipient: '',
      recipientUsername: '',
      myUsername: '',
      requestedUsername: '',
      messageUsername: '',
      messageUserID: '',
      messagesLoaded: false,
      file: null,
      downloadedImages: {},
      imageURL: '',
      actorsToUsernames: {},
      profilePicture: '',
      downloadedProfilePictures: {},
      replying: false,
      replyUserID: '',
      editingSettings: false,
      // Saving thread
      savingThread: false,
      selectedMessages: [],
      threadName: '',
      savedThreads: {}
    }
  },

  watch: {
    async messages(messages) {
      for (const m of messages) {
        if (!(m.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[m.actor] = await this.resolver.actorToUsername(m.actor)
        }
        if (m.bto && m.bto.length && !(m.bto[0] in this.actorsToUsernames)) {
          this.actorsToUsernames[m.bto[0]] = await this.resolver.actorToUsername(m.bto[0])
        }
      }
    },

    async messagesWithAttachments(messages) {
      for (const m of messages) {
        if (!(m.attachment.magnet in this.downloadedImages)) {
          let blob
          try {
            blob = await this.$gf.media.fetch(m.attachment.magnet)
          } catch {
            this.downloadedImages[m.attachment.magnet] = false
            continue
          }
          this.downloadedImages[m.attachment.magnet] = URL.createObjectURL(blob)
        }
      }
    }
  },

  computed: {
    allMessages() {
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m =>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Note'?
          m.type == 'Note' &&
          // Does the message have a content property?
          (
            (m.content &&
            // Is that property a string?
              typeof m.content == 'string') || 
                (m.attachment && 
                  m.attachment.type == "Image")
          )
        )

      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m =>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }

      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0, 10)
    },
    messages() {
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m =>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Note'?
          m.type == 'Note' &&
          // Does the message have a content property?
          (
            (m.content &&
            // Is that property a string?
              typeof m.content == 'string') || 
                (m.attachment && 
                  m.attachment.type == "Image")
          ) &&
          !m.inReplyTo
        )

      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m =>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }

      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0, 10)
    },

    messagesWithAttachments() {
      return this.allMessages.filter(m =>
        m.attachment &&
        m.attachment.type == 'Image' &&
        typeof m.attachment.magnet == 'string')
    },
  },

  methods: {
    enableSaveThreadButton() {
      if (this.selectedMessages.length > 0 && this.threadName.length > 0) {
        document.getElementById("save_thread_button").disabled = false;
      }
      else {
        document.getElementById("save_thread_button").disabled = true;
      }
    },
    toggleSelect(messageID) {
      if (this.selectedMessages.includes(messageID)) {
        let index = this.selectedMessages.indexOf(messageID);
        this.selectedMessages.splice(index, 1);
      } else {
        this.selectedMessages.push(messageID);
      }
    },
    startThread() {
      this.savingThread = true;
    },
    saveThread() {
      this.savedThreads[this.threadName] = this.selectedMessages;
      console.log(this.savedThreads);
      this.selectedMessages = [];
      this.threadName = '';
      this.savingThread = false;
      
    },
    cancelThread() {
      this.selectedMessages = [];
      this.threadName = '';
      this.savingThread = false;
    },
    accessSavedThreads() {
      window.location.href = "saved_threads.html";
    },
    backToChat() {
      window.location.href = "index.html";
    },
    convertDate(date) {
      // convert date to local time showing time first then date with no seconds
      return new Date(date).toLocaleTimeString() + " on " + new Date(date).toLocaleDateString();

    },
    startEditingSettings() {
      this.editingSettings = true;
    },
    stopEditingSettings() {
      this.editingSettings = false;
    },
    messageReplies(message) {
      let replies = this.messagesRaw.filter(
        m =>
          m.type &&
          m.type == 'Note' &&
          m.content &&
          typeof m.content == 'string' &&
          m.inReplyTo &&
          m.inReplyTo == message.id
      )

      if (this.privateMessaging) {
        replies = replies.filter(m =>
          m.bto &&
          m.bto.length == 1 &&
          (
            m.bto[0] == this.recipient ||
            m.actor == this.recipient
          ))
      }
      return replies
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        .slice(0, 10)
    },

    resetAttachedFile() {
      document.getElementById("attached_file").value = "";
    },

    // async getImageByMagnet(magnet) {
    //   if (!(magnet in this.downloadedImages)) {
    //     let blob
    //     try {
    //       blob = await this.$gf.media.fetch(magnet)
    //     } catch {
    //       this.downloadedImages[magnet] = false
    //       return
    //     }
    //     this.downloadedImages[magnet] = URL.createObjectURL(blob)
    //   }
    // },

    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file;
    },
    validateUsername() {
      if (this.requestedUsername == '') {
        document.getElementById("invalid_username").innerHTML = "";
        document.getElementById("request_username_button").disabled = true;
      }
      else if (/^[_]*$/.test(this.requestedUsername)) {
        document.getElementById("invalid_username").innerHTML = "Username cannot only be underscores!";
        document.getElementById("request_username_button").disabled = true;
      }
      else if (/^[a-zA-Z0-9_]*$/.test(this.requestedUsername)) {
        document.getElementById("request_username_button").disabled = false;
        document.getElementById("invalid_username").innerHTML = "";
      }

      else {
        document.getElementById("invalid_username").innerHTML = "Invalid Username! Username must only include letters, numbers, and underscores!";
        document.getElementById("request_username_button").disabled = true;
      }
    },

    findUsername(actorID) {
      this.resolver.actorToUsername(actorID).then((username) => {
        let username_list = document.getElementsByClassName("username");
        for (let i = 0; i < username_list.length; i++) {
          if (username) {
            if (username_list[i].innerHTML == actorID) {
              username_list[i].innerHTML = username;
            }
          }
          else {
            this.setAnonymous(username_list[i], actorID);
          }
        }
      });
      return actorID;
    },

    setAnonymous(element, actorID) {
      if (element.innerHTML == actorID) {
        element.innerHTML = "No Username Found";
      }
    },

    async requestUsername() {
      // if there is an error, don't change the name, else change 
      try {
        if (await this.resolver.requestUsername(this.requestedUsername)) {
          // update the page with the new username
          let usernames = document.getElementsByClassName("username");
          for (let i = 0; i < usernames.length; i++) {
            if (usernames[i].innerHTML == this.myUsername) {
              usernames[i].innerHTML = this.requestedUsername;
            }
          }
          this.myUsername = this.requestedUsername;
          this.requestedUsername = '';
        }
      }
      catch {
        document.getElementById("invalid_username").innerHTML = "Username already taken! Please choose another one!";
      }

    },


    async searchUser() {
      document.getElementById("send_message").disabled = true;
      const user = await this.resolver.usernameToActor(this.recipientUsername);
      if (this.privateMessaging) {
        if (user) {
          this.recipient = user;
          document.getElementById("send_message").disabled = false;
        }
        else {
          this.recipient = '';
          document.getElementById("send_message").disabled = true;
        }
      }
    },

    async sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
      }

      if (this.file !== null) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
      }

      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private
      if (this.privateMessaging) {
        message.bto = [this.recipient]
        message.context = [this.$gf.me, this.recipient]
      } else {
        message.context = [this.channel]
      }

      // Send!
      this.$gf.post(message)
      this.messageText = '';
      this.file = null;
    },

    removeMessage(message) {
      this.$gf.remove(message)
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id
      // And copy over it's existing text
      this.editText = message.content
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText
      // And clear the edit mark
      this.editID = ''
    }
  }
}

const Name = {
  props: ['actor', 'editable'],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        // Filter the raw objects for profile data
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-profile
        .filter(m =>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Profile'?
          m.type == 'Profile' &&
          // Does the message have a name property?
          m.name &&
          // Is that property a string?
          typeof m.name == 'string')
        // Choose the most recent one or null if none exists
        .reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  data() {
    return {
      editing: false,
      editText: '',
    }
  },

  methods: {
    editName() {
      this.editing = true
      // If we already have a profile,
      // initialize the edit text to our existing name
      this.editText = this.profile ? this.profile.name : this.editText
    },

    saveName() {
      if (this.profile) {
        // If we already have a profile, just change the name
        // (this will sync automatically)
        this.profile.name = this.editText
      } else {
        // Otherwise create a profile
        this.$gf.post({
          type: 'Profile',
          name: this.editText
        })
      }

      // Exit the editing state
      this.editing = false
    }
  },

  template: '#name'
}

const Pfp = {
  props: ['actor', 'editable', 'downloadedpfps'],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  data() {
    return {
      editing: false,
      file: null,
      // downloadedProfilePictures: {},
    }
  },

  watch: {
    async profile(pro) {
      let profileid = pro.actor.substring(16, 24);
      // for (const pro of profile) {
      // console.log("profile: beginning", profileid)
      if (!(pro.icon.magnet in this.downloadedpfps)) {
        this.downloadedpfps[pro.icon.magnet] = false;
        // console.log("profile: not in downloadedpfps", profileid)
        let blob;
        try {
          // console.log("profile: fetching the blob", profileid)
          blob = await this.$gf.media.fetch(pro.icon.magnet)
        } catch {
          // console.log("profile: error fetching the blob", profileid)
          this.downloadedpfps[pro.icon.magnet] = false
          return
        }
        // console.log("profile: creating the URL", profileid)
        // console.log(blob);
        this.downloadedpfps[pro.icon.magnet] = URL.createObjectURL(blob);
        // console.log("profile: dictionary key is ", pro.icon.magnet);
        // console.log("profile: dictionary value is ", this.downloadedpfps[pro.icon.magnet])
        // console.log("profile: setting value in dictionary", profileid)
        return;
      }
      // }
    }
  },

  computed: {
    profile() {
      return this.objects.filter(
        m =>
          m.type &&
          m.type == 'Profile' &&
          m.icon &&
          m.icon.type == 'Image' &&
          m.icon.magnet &&
          typeof m.icon.magnet == 'string'
      ).reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  methods: {
    cancelEditing() {
      this.editing = false;
    },

    editProfilePicture() {
      this.editing = true;
    },

    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file;
    },

    async saveProfilePicture() {
      let magnetLink = await this.$gf.media.store(this.file);
      this.$gf.post({
        type: 'Profile',
        icon: {
          type: 'Image',
          magnet: magnetLink
        }
      })
      // if (this.profile) {
      //   this.profile.icon = {
      //     type: 'Image',
      //     magnet: magnetLink
      //   }
      //   // this.myProfilePictureURL = URL.createObjectURL(this.file);
      //   this.file = null;
      // }

      // else {
      //   this.$gf.post({
      //     type: 'Profile',
      //     icon: {
      //       type: 'Image',
      //       magnet: magnetLink
      //     }
      //   })
      //   // this.myProfilePictureURL = URL.createObjectURL(this.file);
      //   this.file = null;
      // }
      this.editing = false
    },
  },

  template: '#pfp'
}

const Like = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: likesRaw } = $gf.useObjects([messageid])
    return { likesRaw }
  },

  computed: {
    likes() {
      return this.likesRaw.filter(l =>
        l.type == 'Like' &&
        l.object == this.messageid)
    },

    numLikes() {
      // Unique number of actors
      return [...new Set(this.likes.map(l => l.actor))].length
    },

    myLikes() {
      return this.likes.filter(l => l.actor == this.$gf.me)
    }
  },

  methods: {
    toggleLike() {
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes)
      } else {
        this.$gf.post({
          type: 'Like',
          object: this.messageid,
          context: [this.messageid]
        })
      }
    }
  },

  template: '#like'
}

const Read = {
  props: ["messageid", "actorstousernames", "myusername"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: readRaw } = $gf.useObjects([messageid])
    return { readRaw }
  },

  computed: {
    reads() {
      return this.readRaw.filter(l =>
        l.type == 'Read' &&
        l.object == this.messageid)
    },

    readUsers() {
      try {
        const userList =  [...new Set(this.reads.map(r => r.actor))].map(actor => this.actorstousernames[actor]);
        return userList;
      }
      catch {
        return "No one has read this message yet!";
      }
    },
  },

  methods: {

  },

  async created() {
    if (!(this.myusername in this.readUsers)) {
      this.$gf.post({
        type: 'Read',
        object: this.messageid,
        context: [this.messageid]
      })
    }
  },

  template: '#read'
}

const Reply = {
  props: ["messageid", "actorstousernames", "myusername", "recip", "channel", "privatemessage"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: repliesRaw } = $gf.useObjects([messageid])
    return { repliesRaw }
  },

  data() {
    return {
      replyText: "",
      file: null,
      recipient: "",
      editText: "",
      editID: "",
    }
  },

  computed: {
    replies() {
      return this.repliesRaw.filter(l =>
        l.type &&
        l.type == 'Note' &&
        l.inReplyTo &&
        l.inReplyTo == this.messageid &&
        l.context.includes(this.messageid)) &&
        (
          (l.content &&
            typeof l.content == 'string') || 
              (l.attachment && 
                l.attachment.type == "Image")
        )
    }
  },

  methods: {
    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file;
    },

    async sendReply() {
      const reply = {
        type: 'Note',
        content: this.replyText,
        inReplyTo: this.messageid,
      }

      if (this.file !== null) {
        reply.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
      }

      if (this.privatemessage) {
        reply.bto = [this.recip];
        reply.context = [this.$gf.me, this.recip, this.messageid];
      }
      else {
        reply.context = [this.channel, this.messageid];
      }

      console.log(reply);

      this.$gf.post(reply);
      this.replyText = "";
      this.file = null;
    },

    removeReply(reply) {
      this.$gf.remove(reply);
    },

    startEditReply(reply) {
      this.editID = reply.id;
      this.editText = reply.content;
    },

    saveEditReply(reply) {
      reply.content = this.editText;
      this.editID = "";
      this.editText = "";
    }
  },

  template: '#reply'
}

app.components = { Name, Like, Read, Pfp, Reply }
Vue.createApp(app)
  .use(GraffitiPlugin(Vue))
  .mount('#app')

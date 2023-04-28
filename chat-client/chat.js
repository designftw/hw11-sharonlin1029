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
    const channel = Vue.ref('default')

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
    }
  },

  computed: {
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
          m.content &&
          // Is that property a string?
          typeof m.content == 'string')

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
  },

  methods: {
    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file;
      console.log(file.name);
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
        if (await this.resolver.requestUsername(this.requestedUsername)){
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

    sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
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
      editText: ''
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

app.components = { Name }
Vue.createApp(app)
  .use(GraffitiPlugin(Vue))
  .mount('#app')

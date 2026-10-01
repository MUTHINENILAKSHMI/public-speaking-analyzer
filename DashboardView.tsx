{/* Navigation */}
<div className="mt-6">
  <h3 className="text-sm font-medium text-white mb-3">
    Navigation
  </h3>

  <div className="space-y-2">
    <button
      onClick={() => onNavigate('Dashboard')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      Dashboard
    </button>

    <button
      onClick={() => onNavigate('New Practice Session')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      New Practice Session
    </button>

    <button
      onClick={() => onNavigate('My Sessions')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      My Sessions
    </button>

    <button
      onClick={() => onNavigate('Compare Sessions')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      Compare Sessions
    </button>

    <button
      onClick={() => onNavigate('Identify Weak Areas')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      Identify Weak Areas
    </button>

    <button
      onClick={() => onNavigate('Profile')}
      className="w-full text-left px-4 py-3 rounded-xl text-white
                 hover:bg-emerald-700/40
                 transition-all duration-200 cursor-pointer"
    >
      Profile
    </button>
  </div>
</div>
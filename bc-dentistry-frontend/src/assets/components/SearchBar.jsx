import Search from "../images/icons/magnifier.png"

const SearchBar = () => {
    return (
        <div id="SearchBar" className="flex w-full gap-x-2 text-neutral-500 sm:w-auto sm:gap-x-4">
            <input type="text" placeholder="Looking for something ?" className="h-10 min-w-0 flex-1 border-b border-gray-300 bg-transparent px-2 text-sm outline-none sm:w-64" />
            <div className="search-icon h-10 w-10 flex p-2.5 rounded-md">
                <img src={Search} alt="" />
            </div>
        </div>
    )
}

export default SearchBar;
